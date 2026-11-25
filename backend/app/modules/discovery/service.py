from __future__ import annotations

import hashlib
import json
import random
import secrets
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import String, and_, exists, func, or_, select, tuple_
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.discovery.pagination import (
    decode_fresh_cursor,
    decode_random_cursor,
    encode_fresh_cursor,
    encode_random_cursor,
)
from app.modules.discovery.schemas import (
    DailyGiftStat,
    FeedResponse,
    NeighbourhoodActivity,
    PublicStats,
    PublicWish,
)
from app.modules.gifts.models import Gift, GiftStatus
from app.modules.identity.models import User, UserStatus
from app.modules.payment_methods.models import (
    PaymentMethodStatus,
    RecipientPaymentMethod,
)
from app.modules.safety.models import UserBlock
from app.modules.wishes.models import Wish, WishMood, WishStatus

SortOrder = Literal["fresh", "random"]
IST = ZoneInfo("Asia/Kolkata")
MAX_SEARCH_LENGTH = 80
MIN_ACTIVE_NEIGHBOURHOODS = 3


@dataclass(frozen=True)
class FeedFilters:
    city: str | None = None
    q: str | None = None
    mood: WishMood | None = None
    amount_min: int | None = None
    amount_max: int | None = None

    def fingerprint(self) -> str:
        """Stable digest of the filters bound into a pagination cursor."""
        canonical = json.dumps(
            {
                "amountMax": self.amount_max,
                "amountMin": self.amount_min,
                "city": self.city.lower() if self.city else None,
                "mood": self.mood.value if self.mood else None,
                "q": self.q.lower() if self.q else None,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def ist_week_window(now: datetime) -> tuple[datetime, datetime]:
    """Return the current ISO week in Asia/Kolkata as inclusive/exclusive UTC bounds."""
    current = now if now.tzinfo is not None else now.replace(tzinfo=UTC)
    local = current.astimezone(IST)
    monday = local.date() - timedelta(days=local.weekday())
    start = datetime.combine(monday, time.min, tzinfo=IST).astimezone(UTC)
    end = datetime.combine(monday + timedelta(days=7), time.min, tzinfo=IST).astimezone(UTC)
    return start, end


def _calculate_date_streak(days: set[date], today: date) -> int:
    if not days:
        return 0
    cursor = today if today in days else today - timedelta(days=1)
    if cursor not in days:
        return 0
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def surprise_weight(
    confirmed_received: int,
    last_confirmed: datetime | None,
    now: datetime,
) -> float:
    if confirmed_received == 0:
        return 3.0
    if last_confirmed is not None and last_confirmed > now - timedelta(days=14):
        return 0.25
    return 1.0


class DiscoveryService:
    def __init__(self, *, settings: Settings, session: Session) -> None:
        self.settings = settings
        self.session = session

    def feed(
        self,
        *,
        viewer_id: UUID | None,
        city: str | None,
        q: str | None,
        mood: WishMood | None,
        amount_min: int | None,
        amount_max: int | None,
        sort: SortOrder,
        cursor: str | None,
        limit: int,
        seed: str | None,
    ) -> FeedResponse:
        """Return a filtered, cursor-paginated public feed.

        Search is a literal, case-insensitive substring match over the public
        wish message and display pseudonym only. A blank search is ignored.
        Amount filters use the publicly exposed suggested amount; wishes with
        no suggested amount do not match an explicit amount filter. Cursors are
        bound to the active city/search/mood/amount filters and are rejected
        when those filters change.
        """
        now = datetime.now(UTC)
        filters = FeedFilters(
            city=(city.strip() if city and city.strip() else None),
            q=(q.strip() if q and q.strip() else None),
            mood=mood,
            amount_min=amount_min,
            amount_max=amount_max,
        )
        self._validate_filters(filters)
        filter_fingerprint = filters.fingerprint()

        resolved_seed = seed or secrets.token_hex(8) if sort == "random" else None
        if sort == "random" and resolved_seed is None:
            resolved_seed = secrets.token_hex(8)

        conditions = [
            Wish.status == WishStatus.OPEN,
            Wish.expires_at > now,
            User.status == UserStatus.ACTIVE,
            User.display_name.is_not(None),
            User.avatar.is_not(None),
        ]
        if filters.city is not None:
            conditions.append(func.lower(Wish.city) == filters.city.lower())
        if filters.q is not None:
            term = filters.q.lower()
            conditions.append(
                or_(
                    func.lower(Wish.message).contains(term, autoescape=True),
                    func.lower(User.display_name).contains(term, autoescape=True),
                )
            )
        if filters.mood is not None:
            conditions.append(Wish.mood == filters.mood)
        if filters.amount_min is not None or filters.amount_max is not None:
            conditions.append(Wish.suggested_amount_inr.is_not(None))
            if filters.amount_min is not None:
                conditions.append(Wish.suggested_amount_inr >= filters.amount_min)
            if filters.amount_max is not None:
                conditions.append(Wish.suggested_amount_inr <= filters.amount_max)
        if viewer_id is not None:
            conditions.append(Wish.user_id != viewer_id)
            conditions.append(
                ~exists().where(
                    UserBlock.blocker_id == viewer_id,
                    UserBlock.blocked_id == Wish.user_id,
                )
            )
            conditions.append(
                ~exists().where(
                    UserBlock.blocker_id == Wish.user_id,
                    UserBlock.blocked_id == viewer_id,
                )
            )

        total_count = int(
            self.session.scalar(
                select(func.count(Wish.id))
                .select_from(Wish)
                .join(User, Wish.user_id == User.id)
                .join(
                    RecipientPaymentMethod,
                    and_(
                        RecipientPaymentMethod.user_id == User.id,
                        RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
                    ),
                )
                .where(*conditions)
            )
            or 0
        )

        statement = (
            select(Wish, User)
            .join(User, Wish.user_id == User.id)
            .join(
                RecipientPaymentMethod,
                and_(
                    RecipientPaymentMethod.user_id == User.id,
                    RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
                ),
            )
        )
        next_cursor: str | None = None

        if sort == "fresh":
            if cursor:
                fresh = decode_fresh_cursor(cursor)
                self._require_cursor_filters(fresh.filter_fingerprint, filter_fingerprint)
                conditions.append(
                    tuple_(Wish.created_at, Wish.id) < tuple_(fresh.created_at, fresh.wish_id)
                )
            statement = (
                statement.where(*conditions)
                .order_by(Wish.created_at.desc(), Wish.id.desc())
                .limit(limit + 1)
            )
        else:
            assert resolved_seed is not None
            hash_expression = func.md5(func.concat(Wish.id.cast(String), resolved_seed))
            if cursor:
                random_cursor = decode_random_cursor(cursor)
                if random_cursor.seed != resolved_seed:
                    raise AppError(
                        400,
                        "VALIDATION_ERROR",
                        "Invalid cursor",
                        "The cursor seed does not match the requested order.",
                    )
                self._require_cursor_filters(
                    random_cursor.filter_fingerprint,
                    filter_fingerprint,
                )
                conditions.append(
                    or_(
                        hash_expression > random_cursor.hash_value,
                        and_(
                            hash_expression == random_cursor.hash_value,
                            Wish.id > random_cursor.wish_id,
                        ),
                    )
                )
            statement = (
                statement.where(*conditions)
                .order_by(hash_expression.asc(), Wish.id.asc())
                .limit(limit + 1)
            )

        rows = list(self.session.execute(statement).all())
        has_more = len(rows) > limit
        visible = rows[:limit]
        wishes = [self._card(wish, user) for wish, user in visible]

        if has_more and visible:
            last_wish = visible[-1][0]
            if sort == "fresh":
                next_cursor = encode_fresh_cursor(
                    last_wish.created_at,
                    last_wish.id,
                    filter_fingerprint,
                )
            else:
                assert resolved_seed is not None
                # Deterministic feed ordering only, not a security primitive.
                digest = hashlib.md5(
                    f"{last_wish.id}{resolved_seed}".encode(),
                    usedforsecurity=False,
                ).hexdigest()
                next_cursor = encode_random_cursor(
                    digest,
                    last_wish.id,
                    resolved_seed,
                    filter_fingerprint,
                )

        return FeedResponse(
            wishes=wishes,
            next_cursor=next_cursor,
            seed=resolved_seed if sort == "random" else None,
            total_count=total_count,
        )

    def public_stats(self, *, now: datetime | None = None) -> PublicStats:
        """Return privacy-safe aggregate Home City Pulse metrics.

        Confirmed metrics count only recipient-confirmed attestations. Gift
        ``updated_at`` is the recipient-confirmation timestamp because the
        confirmed state is terminal. No individual identity, donor-to-recipient
        flow, exact location, VPA, phone, or UTR is selected or returned.

        The seven-day series and area labels are aggregate only. Area labels are
        suppressed below three confirmed gifts in a distinct non-blank wish
        city and are grouped from recipient wish cities, not donor location.
        """
        current = now or datetime.now(UTC)
        current = current.replace(tzinfo=UTC) if current.tzinfo is None else current.astimezone(UTC)
        week_start, week_end = ist_week_window(current)
        local_week_start = week_start.astimezone(IST).date()

        wishes_shared_count = int(self.session.scalar(select(func.count(Wish.id))) or 0)
        member_count = int(
            self.session.scalar(
                select(func.count(User.id)).where(
                    User.status == UserStatus.ACTIVE,
                    User.display_name.is_not(None),
                    User.avatar.is_not(None),
                )
            )
            or 0
        )

        open_wish_count = int(
            self.session.scalar(
                select(func.count(Wish.id))
                .select_from(Wish)
                .join(User, Wish.user_id == User.id)
                .join(
                    RecipientPaymentMethod,
                    and_(
                        RecipientPaymentMethod.user_id == User.id,
                        RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
                    ),
                )
                .where(
                    Wish.status == WishStatus.OPEN,
                    Wish.expires_at > current,
                    User.status == UserStatus.ACTIVE,
                    User.display_name.is_not(None),
                    User.avatar.is_not(None),
                )
            )
            or 0
        )

        confirmed_count, confirmed_value = self.session.execute(
            select(
                func.count(Gift.id),
                func.coalesce(func.sum(Gift.amount_inr), 0),
            ).where(
                Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                Gift.updated_at >= week_start,
                Gift.updated_at < week_end,
            )
        ).one()

        all_time_count, all_time_value = self.session.execute(
            select(
                func.count(Gift.id),
                func.coalesce(func.sum(Gift.amount_inr), 0),
            ).where(Gift.status == GiftStatus.RECIPIENT_CONFIRMED)
        ).one()

        weekly_rows = self.session.execute(
            select(
                func.date(func.timezone("Asia/Kolkata", Gift.updated_at)).label("day"),
                func.count(Gift.id).label("gift_count"),
                func.coalesce(func.sum(Gift.amount_inr), 0).label("gift_value"),
            )
            .where(
                Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                Gift.updated_at >= week_start,
                Gift.updated_at < week_end,
            )
            .group_by("day")
        ).all()
        weekly_by_day = {
            cast(date, day): (
                int(cast(int, gift_count)),
                int(cast(int, gift_value)),
            )
            for day, gift_count, gift_value in weekly_rows
        }
        weekly_confirmed_gifts = [
            DailyGiftStat(
                date=local_week_start + timedelta(days=index),
                count=weekly_by_day.get(local_week_start + timedelta(days=index), (0, 0))[0],
                value_inr=weekly_by_day.get(local_week_start + timedelta(days=index), (0, 0))[1],
            )
            for index in range(7)
        ]

        neighbourhood_count = int(
            self.session.scalar(
                select(func.count(func.distinct(func.lower(func.trim(Wish.city)))))
                .select_from(Gift)
                .join(Wish, Gift.wish_id == Wish.id)
                .where(
                    Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                    Gift.updated_at >= week_start,
                    Gift.updated_at < week_end,
                    Wish.city.is_not(None),
                    func.length(func.trim(Wish.city)) > 0,
                )
            )
            or 0
        )
        if neighbourhood_count < MIN_ACTIVE_NEIGHBOURHOODS:
            neighbourhood_count = 0

        active_neighbourhoods: list[NeighbourhoodActivity] = []
        if neighbourhood_count >= MIN_ACTIVE_NEIGHBOURHOODS:
            area_label = func.lower(func.trim(Wish.city))
            area_rows = self.session.execute(
                select(
                    area_label.label("area_label"),
                    func.count(Gift.id).label("gift_count"),
                )
                .select_from(Gift)
                .join(Wish, Gift.wish_id == Wish.id)
                .where(
                    Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                    Gift.updated_at >= week_start,
                    Gift.updated_at < week_end,
                    Wish.city.is_not(None),
                    func.length(func.trim(Wish.city)) > 0,
                )
                .group_by(area_label)
                .having(func.count(Gift.id) >= MIN_ACTIVE_NEIGHBOURHOODS)
                .order_by(func.count(Gift.id).desc(), area_label.asc())
                .limit(6)
            ).all()
            active_neighbourhoods = [
                NeighbourhoodActivity(
                    label=str(label),
                    confirmed_gift_count=int(cast(int, gift_count)),
                )
                for label, gift_count in area_rows
                if label
            ]

        confirmed_days: set[date] = set()
        day_rows = cast(
            Iterable[date | None],
            self.session.scalars(
                select(func.date(func.timezone("Asia/Kolkata", Gift.updated_at)))
                .where(Gift.status == GiftStatus.RECIPIENT_CONFIRMED)
                .distinct()
            ),
        )
        for value in day_rows:
            if value is not None:
                confirmed_days.add(value)
        community_streak_days = _calculate_date_streak(
            confirmed_days,
            current.astimezone(IST).date(),
        )

        return PublicStats(
            wishes_shared_count=wishes_shared_count,
            member_count=member_count,
            open_wish_count=open_wish_count,
            confirmed_gift_count_all_time=int(all_time_count or 0),
            confirmed_gift_value_inr_all_time=int(all_time_value or 0),
            confirmed_gift_count_this_week=int(confirmed_count or 0),
            confirmed_gift_value_inr_this_week=int(confirmed_value or 0),
            active_neighbourhood_count_this_week=neighbourhood_count,
            community_streak_days=community_streak_days,
            weekly_confirmed_gifts=weekly_confirmed_gifts,
            active_neighbourhoods=active_neighbourhoods,
            generated_at=current,
        )

    @staticmethod
    def _validate_filters(filters: FeedFilters) -> None:
        if filters.q is not None and len(filters.q) > MAX_SEARCH_LENGTH:
            raise AppError(
                422,
                "VALIDATION_ERROR",
                "Invalid search",
                f"Search must be at most {MAX_SEARCH_LENGTH} characters.",
            )
        for value in (filters.amount_min, filters.amount_max):
            if value is not None and not 10 <= value <= 100:
                raise AppError(
                    422,
                    "VALIDATION_ERROR",
                    "Invalid amount filter",
                    "Amount filters must be between 10 and 100 INR.",
                )
        if (
            filters.amount_min is not None
            and filters.amount_max is not None
            and filters.amount_max < filters.amount_min
        ):
            raise AppError(
                422,
                "VALIDATION_ERROR",
                "Invalid amount range",
                "amount_max must be greater than or equal to amount_min.",
            )

    @staticmethod
    def _require_cursor_filters(
        cursor_fingerprint: str | None,
        filter_fingerprint: str,
    ) -> None:
        if cursor_fingerprint is None:
            if filter_fingerprint != FeedFilters().fingerprint():
                raise AppError(
                    400,
                    "VALIDATION_ERROR",
                    "Invalid cursor",
                    "The cursor was created for different filters. Restart from the first page.",
                )
            return
        if cursor_fingerprint != filter_fingerprint:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid cursor",
                "The cursor was created for different filters. Restart from the first page.",
            )

    def get_public(self, wish_id: UUID, viewer_id: UUID | None) -> PublicWish:
        wish, user = self._load(wish_id)
        if wish is None or user is None:
            raise self._not_found()
        is_own_wish = viewer_id is not None and wish.user_id == viewer_id
        if not self._eligible(wish, user, viewer_id, allow_owner=True):
            raise self._not_found()
        return self._card(wish, user, is_own_wish=is_own_wish)

    def select(self, wish_id: UUID, viewer_id: UUID) -> PublicWish:
        wish, user = self._load(wish_id)
        if wish is None or user is None:
            raise self._not_found()
        if wish.user_id == viewer_id or not self._eligible(wish, user, viewer_id):
            raise AppError(
                409,
                "WISH_UNAVAILABLE",
                "Wish unavailable",
                "This wish is no longer available for selection.",
            )
        return self._card(wish, user)

    def surprise_candidates(
        self,
        *,
        viewer_id: UUID,
        skipped_wish_ids: list[UUID],
        city: str | None,
        now: datetime | None = None,
    ) -> list[tuple[Wish, User, float]]:
        current = now or datetime.now(UTC)
        conditions = [
            Wish.status == WishStatus.OPEN,
            Wish.expires_at > current,
            Wish.user_id != viewer_id,
            User.status == UserStatus.ACTIVE,
            User.display_name.is_not(None),
            User.avatar.is_not(None),
            ~exists().where(
                UserBlock.blocker_id == viewer_id,
                UserBlock.blocked_id == Wish.user_id,
            ),
            ~exists().where(
                UserBlock.blocker_id == Wish.user_id,
                UserBlock.blocked_id == viewer_id,
            ),
        ]
        if city and city.strip():
            conditions.append(func.lower(Wish.city) == city.strip().lower())
        if skipped_wish_ids:
            conditions.append(~Wish.id.in_(skipped_wish_ids))
        rows = self.session.execute(
            select(Wish, User)
            .join(User, Wish.user_id == User.id)
            .join(
                RecipientPaymentMethod,
                and_(
                    RecipientPaymentMethod.user_id == User.id,
                    RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
                ),
            )
            .where(*conditions)
            .limit(200)
        ).all()

        owner_ids = {user.id for _, user in rows}
        history_rows = self.session.execute(
            select(
                Gift.recipient_id,
                func.count(Gift.id),
                func.max(Gift.updated_at),
            )
            .where(
                Gift.recipient_id.in_(owner_ids),
                Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
            )
            .group_by(Gift.recipient_id)
        ).all()
        history = {
            recipient_id: (int(count), last_confirmed)
            for recipient_id, count, last_confirmed in history_rows
        }
        candidates: list[tuple[Wish, User, float]] = []
        for wish, user in rows:
            count, last_confirmed = history.get(user.id, (0, None))
            candidates.append(
                (
                    wish,
                    user,
                    surprise_weight(count, last_confirmed, current),
                )
            )
        return candidates

    def surprise(
        self,
        *,
        viewer_id: UUID,
        skipped_wish_ids: list[UUID],
        city: str | None,
        rng: random.Random | None = None,
    ) -> PublicWish:
        candidates = self.surprise_candidates(
            viewer_id=viewer_id,
            skipped_wish_ids=skipped_wish_ids,
            city=city,
        )
        if not candidates:
            raise AppError(
                404,
                "NO_ELIGIBLE_WISHES",
                "No eligible wishes",
                "No wishes are eligible for Surprise Me right now.",
            )
        generator = rng or random.SystemRandom()
        total = sum(weight for _, _, weight in candidates)
        pick = generator.uniform(0, total)
        cursor = 0.0
        for wish, user, weight in candidates:
            cursor += weight
            if pick <= cursor:
                return self._card(wish, user)
        wish, user, _ = candidates[-1]
        return self._card(wish, user)

    def _load(self, wish_id: UUID) -> tuple[Wish | None, User | None]:
        row = self.session.execute(
            select(Wish, User).join(User, Wish.user_id == User.id).where(Wish.id == wish_id)
        ).first()
        if row is None:
            return None, None
        return row[0], row[1]

    def _eligible(
        self,
        wish: Wish,
        user: User,
        viewer_id: UUID | None,
        *,
        allow_owner: bool = False,
    ) -> bool:
        now = datetime.now(UTC)
        if wish.status != WishStatus.OPEN or wish.expires_at <= now:
            return False
        if user.status != UserStatus.ACTIVE:
            return False
        if not user.display_name or not user.avatar:
            return False
        if viewer_id is not None and wish.user_id == viewer_id and not allow_owner:
            return False
        payment_method = self.session.scalar(
            select(RecipientPaymentMethod.id).where(
                RecipientPaymentMethod.user_id == user.id,
                RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
            )
        )
        if payment_method is None:
            return False
        if viewer_id is not None:
            blocked = self.session.scalar(
                select(UserBlock.blocker_id).where(
                    or_(
                        and_(
                            UserBlock.blocker_id == viewer_id,
                            UserBlock.blocked_id == user.id,
                        ),
                        and_(
                            UserBlock.blocker_id == user.id,
                            UserBlock.blocked_id == viewer_id,
                        ),
                    )
                )
            )
            if blocked is not None:
                return False
        return True

    def _card(self, wish: Wish, user: User, *, is_own_wish: bool = False) -> PublicWish:
        return PublicWish(
            id=wish.id,
            display_name=user.display_name or "Kindly user",
            avatar=user.avatar or "SPARK",
            city=wish.city or user.city,
            created_at=wish.created_at,
            mood=wish.mood,
            message=wish.message,
            suggested_amount_inr=wish.suggested_amount_inr,
            is_own_wish=is_own_wish,
        )

    @staticmethod
    def _not_found() -> AppError:
        return AppError(
            404,
            "NOT_FOUND",
            "Wish not found",
            "This wish is unavailable or no longer visible.",
        )
