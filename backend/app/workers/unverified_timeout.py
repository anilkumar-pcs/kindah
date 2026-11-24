from __future__ import annotations

import argparse
import logging
import time
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import Database
from app.core.logging import configure_logging
from app.modules.gifts.models import (
    Gift,
    GiftEvent,
    GiftStatus,
    OutboxEvent,
    WishReservation,
)
from app.modules.notifications.service import notify
from app.modules.wishes.models import Wish, WishStatus

logger = logging.getLogger("kindly.workers.unverified_timeout")


def mark_unverified(
    *,
    session: Session,
    settings: Settings,
    now: datetime | None = None,
    batch_size: int = 100,
) -> int:
    current = now or datetime.now(UTC)
    candidates = list(
        session.scalars(
            select(Gift)
            .where(
                Gift.status == GiftStatus.DONOR_CLAIMED_PAID,
                Gift.recipient_response_deadline <= current,
            )
            .order_by(Gift.recipient_response_deadline)
            .limit(batch_size)
        )
    )

    marked = 0
    for candidate in candidates:
        wish = session.scalar(
            select(Wish)
            .where(Wish.id == candidate.wish_id)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        reservation = session.scalar(
            select(WishReservation)
            .where(WishReservation.gift_id == candidate.id)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        gift = session.scalar(
            select(Gift)
            .where(Gift.id == candidate.id)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        if wish is None or reservation is None or gift is None:
            continue
        if (
            gift.status != GiftStatus.DONOR_CLAIMED_PAID
            or gift.recipient_response_deadline is None
            or gift.recipient_response_deadline > current
        ):
            continue

        gift.status = GiftStatus.UNVERIFIED
        gift.updated_at = current
        wish.status = WishStatus.UNVERIFIED
        wish.updated_at = current
        session.add(
            GiftEvent(
                gift_id=gift.id,
                actor_id=None,
                event_type="RECIPIENT_RESPONSE_TIMEOUT",
                from_state=GiftStatus.DONOR_CLAIMED_PAID.value,
                to_state=GiftStatus.UNVERIFIED.value,
                idempotency_key=f"gift:{gift.id}:unverified-timeout",
            )
        )
        session.add(
            OutboxEvent(
                aggregate_type="gift",
                aggregate_id=gift.id,
                event_type="GIFT_UNVERIFIED",
                payload={"giftId": str(gift.id)},
                idempotency_key=f"outbox:{gift.id}:unverified",
            )
        )
        notify(
            session=session,
            user_id=gift.donor_id,
            dedupe_key=f"gift:{gift.id}:unverified:donor",
            notification_type="GIFT_UNVERIFIED",
            title="Gift unverified",
            body=(
                f"The recipient did not confirm your ₹{gift.amount_inr} gift within "
                "24 hours. It is now unverified."
            ),
            entity_type="GIFT",
            entity_id=gift.id,
            payload={"giftId": str(gift.id)},
        )
        notify(
            session=session,
            user_id=gift.recipient_id,
            dedupe_key=f"gift:{gift.id}:unverified:recipient",
            notification_type="GIFT_UNVERIFIED",
            title="Confirmation window ended",
            body=(
                "The 24-hour confirmation window ended. This gift is unverified; "
                "open it for support options."
            ),
            entity_type="GIFT",
            entity_id=gift.id,
            payload={"giftId": str(gift.id)},
        )
        marked += 1

    if marked:
        session.commit()
    return marked


def run_once(settings: Settings | None = None, now: datetime | None = None) -> int:
    resolved = settings or get_settings()
    database = Database(resolved.database_url, resolved.db_connect_timeout_seconds)
    try:
        with database.session() as session:
            return mark_unverified(session=session, settings=resolved, now=now)
    finally:
        database.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Mark unverified gifts after timeout")
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=300)
    args = parser.parse_args()

    settings = get_settings()
    configure_logging(settings.log_level)
    while True:
        count = run_once(settings)
        logger.info("unverified_timeout_run", extra={"marked_count": count})
        if not args.loop:
            break
        time.sleep(max(30, args.interval))


if __name__ == "__main__":
    main()
