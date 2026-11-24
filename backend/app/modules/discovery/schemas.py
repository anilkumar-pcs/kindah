from __future__ import annotations

from datetime import datetime
from uuid import UUID

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


class FeedResponse(ApiModel):
    wishes: list[PublicWish]
    next_cursor: str | None
    seed: str | None
