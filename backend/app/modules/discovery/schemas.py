from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.core.schemas import ApiModel
from app.modules.wishes.models import WishMood


class PublicWish(ApiModel):
    id: UUID
    display_name: str
    avatar: str
    city: str | None
    created_at: datetime
    mood: WishMood
    message: str
    suggested_amount_inr: int | None
    is_own_wish: bool = False


class FeedResponse(ApiModel):
    """Public discovery page.

    ``total_count`` is the number of currently visible wishes matching the
    active city/search/mood/amount filters, independent of the page cursor.
    It is additive to the pre-existing feed response shape.
    """

    wishes: list[PublicWish]
    next_cursor: str | None
    seed: str | None
    total_count: int = Field(ge=0)


class DailyGiftStat(ApiModel):
    date: date
    count: int = Field(ge=0)
    value_inr: int = Field(ge=0)


class NeighbourhoodActivity(ApiModel):
    label: str
    confirmed_gift_count: int = Field(ge=3)


class PublicStats(ApiModel):
    """Aggregate Home City Pulse metrics.

    These are attestation and aggregate counts from recipient-confirmed gifts,
    not bank-verified payment volume. They deliberately exclude donor identity,
    recipient identity, individual donor-to-recipient flows, raw VPA, phone,
    UTR, and precise user location.

    ``confirmed_gift_*_this_week``, ``weekly_confirmed_gifts`` and
    ``active_neighbourhood*`` cover the current ISO week in Asia/Kolkata
    (Monday 00:00 inclusive to the following Monday 00:00 exclusive).
    ``active_neighbourhood_count_this_week`` and ``active_neighbourhoods`` are
    suppressed below three recipient-confirmed gifts in a distinct non-blank
    wish city. ``community_streak_days`` is the number of consecutive
    Asia/Kolkata calendar days ending today or yesterday on which at least one
    recipient-confirmed gift occurred.
    """

    wishes_shared_count: int = Field(
        ge=0,
        description="All wishes ever shared, including closed wishes. Aggregate only.",
    )
    member_count: int = Field(
        ge=0,
        description="Active pseudonymous members with a completed public profile.",
    )
    open_wish_count: int = Field(
        ge=0,
        description="Currently discoverable open wishes, not expired or moderated.",
    )
    confirmed_gift_count_all_time: int = Field(
        ge=0,
        description="Recipient-confirmed gift attestations across the beta.",
    )
    confirmed_gift_value_inr_all_time: int = Field(
        ge=0,
        description=(
            "Sum of recipient-confirmed gift amounts across the beta; attested, not bank-verified."
        ),
    )
    confirmed_gift_count_this_week: int = Field(
        ge=0,
        description="Recipient-confirmed gift attestations this ISO week (Asia/Kolkata).",
    )
    confirmed_gift_value_inr_this_week: int = Field(
        ge=0,
        description=(
            "Sum of recipient-confirmed gift amounts this ISO week (Asia/Kolkata); "
            "attested, not bank-verified."
        ),
    )
    active_neighbourhood_count_this_week: int = Field(
        ge=0,
        description=(
            "Distinct non-blank wish cities with recipient-confirmed gifts this week; "
            "zero when suppressed below three."
        ),
    )
    community_streak_days: int = Field(
        ge=0,
        description=(
            "Consecutive Asia/Kolkata days ending today or yesterday with at least "
            "one recipient-confirmed gift."
        ),
    )
    weekly_confirmed_gifts: list[DailyGiftStat] = Field(default_factory=list)
    active_neighbourhoods: list[NeighbourhoodActivity] = Field(default_factory=list)
    generated_at: datetime


class SurpriseRequest(ApiModel):
    skipped_wish_ids: list[UUID] = Field(default_factory=list, max_length=50)
    city: str | None = Field(default=None, max_length=60)
