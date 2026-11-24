from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.identity.dependencies import get_current_auth
from app.modules.identity.service import AuthContext
from app.modules.notifications.schemas import (
    MarkAllReadResponse,
    NotificationList,
    NotificationResponse,
)
from app.modules.notifications.service import NotificationService

router = APIRouter(tags=["notifications"])


def get_notification_service(
    session: Session = Depends(get_db_session),
) -> NotificationService:
    return NotificationService(session)


@router.get("/me/notifications", response_model=NotificationList)
def list_notifications(
    auth: AuthContext = Depends(get_current_auth),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationList:
    return service.list_for_user(auth.user)


@router.post(
    "/me/notifications/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    return service.mark_read(auth.user, notification_id)


@router.post("/me/notifications/read-all", response_model=MarkAllReadResponse)
def mark_all_notifications_read(
    auth: AuthContext = Depends(get_current_auth),
    service: NotificationService = Depends(get_notification_service),
) -> MarkAllReadResponse:
    return MarkAllReadResponse(marked=service.mark_all_read(auth.user))
