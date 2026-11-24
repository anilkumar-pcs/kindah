from __future__ import annotations

import argparse
import logging
import time
from datetime import UTC, datetime, timedelta

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
    ReservationStatus,
    WishReservation,
)
from app.modules.wishes.models import Wish, WishStatus

logger = logging.getLogger("kindly.workers.reservation_expiry")


def expire_reservations(
    *,
    session: Session,
    settings: Settings,
    now: datetime | None = None,
    batch_size: int = 100,
) -> int:
    current = now or datetime.now(UTC)
    candidates = list(
        session.scalars(
            select(WishReservation)
            .where(
                WishReservation.status == ReservationStatus.ACTIVE,
                WishReservation.expires_at <= current,
            )
            .order_by(WishReservation.expires_at)
            .limit(batch_size)
        )
    )

    expired = 0
    for candidate in candidates:
        wish = session.scalar(
            select(Wish)
            .where(Wish.id == candidate.wish_id)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        reservation = session.scalar(
            select(WishReservation)
            .where(WishReservation.id == candidate.id)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        gift = session.scalar(
            select(Gift)
            .where(Gift.id == candidate.gift_id)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        if wish is None or reservation is None or gift is None:
            continue
        if reservation.status != ReservationStatus.ACTIVE or reservation.expires_at > current:
            continue
        if gift.status in {
            GiftStatus.DONOR_CLAIMED_PAID,
            GiftStatus.RECIPIENT_CONFIRMED,
            GiftStatus.UNVERIFIED,
            GiftStatus.DISPUTED,
        }:
            continue

        was_pending = gift.status == GiftStatus.DONOR_PENDING
        gift.status = GiftStatus.ABANDONED
        gift.updated_at = current
        reservation.status = ReservationStatus.EXPIRED
        reservation.released_at = current
        reservation.release_reason = "RESERVATION_TIMEOUT"
        reservation.updated_at = current

        if was_pending:
            # DEC-A04: never reopen a still-processing handoff.
            wish.status = WishStatus.EXPIRED
            wish.closed_reason = "EXPIRED"
            wish.cooldown_until = current + timedelta(hours=settings.wish_cooldown_hours)
        elif wish.expires_at > current:
            wish.status = WishStatus.OPEN
        else:
            wish.status = WishStatus.EXPIRED
            wish.closed_reason = "EXPIRED"
            wish.cooldown_until = current + timedelta(hours=settings.wish_cooldown_hours)
        wish.updated_at = current

        session.add(
            GiftEvent(
                gift_id=gift.id,
                actor_id=None,
                event_type="RESERVATION_EXPIRED",
                from_state=GiftStatus.DONOR_PENDING.value
                if was_pending
                else GiftStatus.HANDOFF_ISSUED.value,
                to_state=GiftStatus.ABANDONED.value,
                idempotency_key=f"gift:{gift.id}:reservation-expired",
            )
        )
        session.add(
            OutboxEvent(
                aggregate_type="gift",
                aggregate_id=gift.id,
                event_type="GIFT_ABANDONED",
                payload={"giftId": str(gift.id), "pending": was_pending},
                idempotency_key=f"outbox:{gift.id}:abandoned",
            )
        )
        expired += 1

    if expired:
        session.commit()
    return expired


def run_once(settings: Settings | None = None, now: datetime | None = None) -> int:
    resolved = settings or get_settings()
    database = Database(resolved.database_url, resolved.db_connect_timeout_seconds)
    try:
        with database.session() as session:
            return expire_reservations(session=session, settings=resolved, now=now)
    finally:
        database.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Expire due gift reservations")
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=45)
    args = parser.parse_args()

    settings = get_settings()
    configure_logging(settings.log_level)
    while True:
        count = run_once(settings)
        logger.info("reservation_expiry_run", extra={"expired_count": count})
        if not args.loop:
            break
        time.sleep(max(10, args.interval))


if __name__ == "__main__":
    main()
