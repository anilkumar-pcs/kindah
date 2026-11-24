from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.core.schemas import ApiModel


class KarmaEventResponse(ApiModel):
    id: UUID
    event_type: str
    points_delta: int
    gift_id: UUID | None
    created_at: datetime


class KarmaBadgeResponse(ApiModel):
    badge_code: str
    unlocked_at: datetime


class KarmaSummaryResponse(ApiModel):
    balance: int
    streak: int
    events: list[KarmaEventResponse]
    badges: list[KarmaBadgeResponse]
