from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, StrictInt

from app.core.schemas import ApiModel
from app.modules.wishes.models import WishMood, WishStatus

MoodLiteral = Literal["CHAI_SNACK", "JUST_BECAUSE", "LONG_DAY", "TINY_TREAT"]


class WishCreateRequest(ApiModel):
    message: str = Field(min_length=10, max_length=120)
    mood: MoodLiteral
    suggested_amount_inr: StrictInt | None = Field(default=None, ge=10, le=100)
    city: str | None = Field(default=None, max_length=60)


class WishResponse(ApiModel):
    id: UUID
    message: str
    mood: WishMood
    suggested_amount_inr: int | None
    city: str | None
    status: WishStatus
    expires_at: datetime
    cooldown_until: datetime | None
    closed_reason: str | None
    created_at: datetime


class WishListResponse(ApiModel):
    wishes: list[WishResponse]
