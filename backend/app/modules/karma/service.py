from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.gifts.models import Gift, GiftStatus, KarmaEvent
from app.modules.karma.badges import BadgeDefinition
from app.modules.karma.models import UserBadge
from app.modules.karma.schemas import (
    KarmaBadgeResponse,
    KarmaEventResponse,
    KarmaSummaryResponse,
)

IST = ZoneInfo("Asia/Kolkata")


def ist_date(value: datetime) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(IST).date()


def calculate_streak(dates: list[datetime], now: datetime | None = None) -> int:
    days = {ist_date(value) for value in dates}
    if not days:
        return 0
    today = ist_date(now or datetime.now(UTC))
    cursor = today if today in days else today - timedelta(days=1)
    if cursor not in days:
        return 0
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


class KarmaService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def balance(self, user_id: UUID) -> int:
        return int(
            self.session.scalar(
                select(func.coalesce(func.sum(KarmaEvent.points_delta), 0)).where(
                    KarmaEvent.user_id == user_id
                )
            )
            or 0
        )

    def streak(self, user_id: UUID, now: datetime | None = None) -> int:
        confirmed_at = list(
            self.session.scalars(
                select(Gift.updated_at).where(
                    Gift.donor_id == user_id,
                    Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                )
            )
        )
        return calculate_streak(confirmed_at, now)

    def summary(self, user_id: UUID) -> KarmaSummaryResponse:
        events = list(
            self.session.scalars(
                select(KarmaEvent)
                .where(KarmaEvent.user_id == user_id)
                .order_by(KarmaEvent.created_at.desc())
                .limit(100)
            )
        )
        badges = list(
            self.session.scalars(
                select(UserBadge)
                .where(UserBadge.user_id == user_id)
                .order_by(UserBadge.unlocked_at)
            )
        )
        definitions = {
            definition.code: definition
            for definition in self.session.scalars(select(BadgeDefinition))
        }
        return KarmaSummaryResponse(
            balance=self.balance(user_id),
            streak=self.streak(user_id),
            events=[
                KarmaEventResponse(
                    id=event.id,
                    event_type=event.event_type,
                    points_delta=event.points_delta,
                    gift_id=event.gift_id,
                    created_at=event.created_at,
                )
                for event in events
            ],
            badges=[
                KarmaBadgeResponse(
                    badge_code=badge.badge_code,
                    label=(
                        definitions[badge.badge_code].label
                        if badge.badge_code in definitions
                        else badge.badge_code
                    ),
                    unlocked_at=badge.unlocked_at,
                )
                for badge in badges
            ],
        )

    def award_badges(self, user_id: UUID, now: datetime | None = None) -> None:
        current = now or datetime.now(UTC)
        self.session.flush()
        confirmed_sent = int(
            self.session.scalar(
                select(func.count(Gift.id)).where(
                    Gift.donor_id == user_id,
                    Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                )
            )
            or 0
        )
        confirmed_received = int(
            self.session.scalar(
                select(func.count(Gift.id)).where(
                    Gift.recipient_id == user_id,
                    Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                )
            )
            or 0
        )
        thanks_received = int(
            self.session.scalar(
                select(func.count(Gift.id)).where(
                    Gift.recipient_id == user_id,
                    Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                    or_(
                        Gift.reaction.is_not(None),
                        Gift.thank_you_message.is_not(None),
                    ),
                )
            )
            or 0
        )
        streak = self.streak(user_id, current)
        metrics = {
            "CONFIRMED_SENT": confirmed_sent,
            "THANKS_RECEIVED": thanks_received if confirmed_received else 0,
            "STREAK_DAYS": streak,
        }
        definitions = list(
            self.session.scalars(
                select(BadgeDefinition)
                .where(BadgeDefinition.active.is_(True))
                .order_by(BadgeDefinition.sort_order)
            )
        )
        for definition in definitions:
            value = metrics.get(definition.rule_type)
            if value is None or value < definition.threshold:
                continue
            self.session.execute(
                insert(UserBadge)
                .values(
                    user_id=user_id,
                    badge_code=definition.code,
                    unlocked_at=current,
                )
                .on_conflict_do_nothing(index_elements=["user_id", "badge_code"])
            )
