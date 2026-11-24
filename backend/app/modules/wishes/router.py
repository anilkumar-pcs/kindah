from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.identity.dependencies import require_active_auth
from app.modules.identity.service import AuthContext
from app.modules.wishes.schemas import (
    WishCreateRequest,
    WishListResponse,
    WishResponse,
)
from app.modules.wishes.service import WishService

router = APIRouter(tags=["wishes"])


def get_wish_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> WishService:
    return WishService(settings=request.app.state.settings, session=session)


@router.post(
    "/wishes",
    response_model=WishResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wish(
    body: WishCreateRequest,
    auth: AuthContext = Depends(require_active_auth),
    service: WishService = Depends(get_wish_service),
) -> WishResponse:
    wish = service.create(auth.user, body)
    return service.response(wish)


@router.delete(
    "/wishes/{wish_id}",
    response_model=WishResponse,
)
def withdraw_wish(
    wish_id: UUID,
    auth: AuthContext = Depends(require_active_auth),
    service: WishService = Depends(get_wish_service),
) -> WishResponse:
    wish = service.withdraw(auth.user, wish_id)
    return service.response(wish)


@router.get(
    "/me/wishes",
    response_model=WishListResponse,
)
def list_my_wishes(
    auth: AuthContext = Depends(require_active_auth),
    service: WishService = Depends(get_wish_service),
) -> WishListResponse:
    wishes = service.list_for_user(auth.user)
    return WishListResponse(wishes=[service.response(wish) for wish in wishes])
