from __future__ import annotations

import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.identity.models import User
from app.modules.notifications.models import Notification
from app.modules.notifications.schemas import (
    NotificationList,
    NotificationResponse,
)


def notify(
    *,
    session: Session,
    user_id: UUID,
    dedupe_key: str,
    notification_type: str,
    title: str,
    body: str,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    payload: dict[str, object] | None = None,
) -> None:
    """Insert a notification once per (user, dedupe key) in the caller's transaction."""

    statement = (
        insert(Notification)
        .values(
            id=uuid.uuid4(),
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload or {},
            dedupe_key=dedupe_key,
            created_at=datetime.now(UTC),
        )
        .on_conflict_do_nothing(index_elements=["user_id", "dedupe_key"])
    )
    session.execute(statement)


class NotificationService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_user(self, user: User) -> NotificationList:
        rows = list(
            self.session.scalars(
                select(Notification)
                .where(Notification.user_id == user.id)
                .order_by(Notification.created_at.desc())
                .limit(100)
            )
        )
        unread = self.session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
        )
        return NotificationList(
            notifications=[self._response(row) for row in rows],
            unread_count=int(unread or 0),
        )

    def mark_read(self, user: User, notification_id: UUID) -> NotificationResponse:
        row = self.session.scalar(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user.id,
            )
        )
        if row is None:
            raise AppError(
                404,
                "NOT_FOUND",
                "Notification not found",
                "This notification is unavailable.",
            )
        if row.read_at is None:
            row.read_at = datetime.now(UTC)
            self.session.commit()
        return self._response(row)

    def mark_all_read(self, user: User) -> int:
        result = self.session.execute(
            update(Notification)
            .where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
            .values(read_at=datetime.now(UTC))
        )
        self.session.commit()
        return int(getattr(result, "rowcount", 0) or 0)

    def _response(self, row: Notification) -> NotificationResponse:
        return NotificationResponse(
            id=row.id,
            notification_type=row.notification_type,
            title=row.title,
            body=row.body,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            payload=row.payload,
            read_at=row.read_at,
            created_at=row.created_at,
        )
