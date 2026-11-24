from __future__ import annotations

import argparse
import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import Database
from app.core.logging import configure_logging
from app.modules.gifts.models import OutboxEvent

logger = logging.getLogger("kindly.workers.outbox")

KNOWN_EVENTS = frozenset(
    {
        "GIFT_HANDOFF_ISSUED",
        "DONOR_CLAIMED_PAID",
        "DONOR_STILL_PROCESSING",
        "DONOR_FAILED",
        "RECIPIENT_CONFIRMED",
        "RECIPIENT_DISPUTED",
        "GIFT_UNVERIFIED",
        "GIFT_ABANDONED",
    }
)

OutboxHandler = Callable[[OutboxEvent], None]


class UnknownOutboxEvent(Exception):
    pass


def deliver_outbox_event(event: OutboxEvent) -> None:
    """Default delivery hook.

    In-app notifications are written transactionally with domain state, so the
    default handler only validates the event type. Push/SMS adapters (P7.8) and
    external consumers plug in here; handlers must be idempotent because a
    worker crash after side effects but before commit causes redelivery.
    """

    if event.event_type not in KNOWN_EVENTS:
        raise UnknownOutboxEvent(f"Unknown outbox event: {event.event_type}")


def alert_dead_letter(event: OutboxEvent) -> None:
    logger.error(
        "outbox_dead_letter",
        extra={
            "outbox_id": str(event.id),
            "event_type": event.event_type,
            "aggregate_type": event.aggregate_type,
            "attempts": event.attempts,
            "reason": event.dead_letter_reason,
        },
    )


def dispatch_outbox(
    *,
    session: Session,
    settings: Settings,
    now: datetime | None = None,
    handler: OutboxHandler | None = None,
    on_dead_letter: Callable[[OutboxEvent], None] | None = None,
) -> tuple[int, int]:
    current = now or datetime.now(UTC)
    process = handler or deliver_outbox_event
    alert = on_dead_letter or alert_dead_letter
    events = list(
        session.scalars(
            select(OutboxEvent)
            .where(
                OutboxEvent.processed_at.is_(None),
                OutboxEvent.dead_letter_reason.is_(None),
                or_(
                    OutboxEvent.next_attempt_at.is_(None),
                    OutboxEvent.next_attempt_at <= current,
                ),
            )
            .order_by(OutboxEvent.created_at)
            .with_for_update(skip_locked=True)
            .limit(settings.outbox_batch_size)
        )
    )

    processed = 0
    dead_lettered = 0
    for event in events:
        event.attempts += 1
        try:
            process(event)
        except Exception as exc:  # handler failures are isolated per event
            event.next_attempt_at = current + timedelta(
                seconds=settings.outbox_retry_base_seconds * (2 ** (event.attempts - 1))
            )
            if event.attempts >= settings.outbox_max_attempts:
                event.dead_letter_reason = type(exc).__name__[:120]
                event.next_attempt_at = None
                dead_lettered += 1
                alert(event)
            logger.warning(
                "outbox_delivery_failed",
                extra={
                    "outbox_id": str(event.id),
                    "event_type": event.event_type,
                    "attempts": event.attempts,
                    "error_type": type(exc).__name__,
                },
            )
            continue
        event.processed_at = current
        event.next_attempt_at = None
        processed += 1

    if events:
        session.commit()
    return processed, dead_lettered


def count_dead_letters(session: Session) -> int:
    return int(
        session.scalar(
            select(func.count(OutboxEvent.id)).where(OutboxEvent.dead_letter_reason.is_not(None))
        )
        or 0
    )


def run_once(settings: Settings | None = None, now: datetime | None = None) -> tuple[int, int]:
    resolved = settings or get_settings()
    database = Database(resolved.database_url, resolved.db_connect_timeout_seconds)
    try:
        with database.session() as session:
            return dispatch_outbox(session=session, settings=resolved, now=now)
    finally:
        database.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Dispatch durable outbox events")
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=30)
    args = parser.parse_args()

    settings = get_settings()
    configure_logging(settings.log_level)
    while True:
        processed, dead_lettered = run_once(settings)
        logger.info(
            "outbox_dispatch_run",
            extra={"processed": processed, "dead_lettered": dead_lettered},
        )
        if not args.loop:
            break
        time.sleep(max(5, args.interval))


if __name__ == "__main__":
    main()
