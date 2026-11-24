from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.core.schemas import ApiModel


class NotificationResponse(ApiModel):
    id: UUID
    notification_type: str
    title: str
    body: str
    entity_type: str | None
    entity_id: UUID | None
    payload: dict[str, object]
    read_at: datetime | None
    created_at: datetime


class NotificationList(ApiModel):
    notifications: list[NotificationResponse]
    unread_count: int


class MarkAllReadResponse(ApiModel):
    marked: int
