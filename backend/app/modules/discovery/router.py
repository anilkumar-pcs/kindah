from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.discovery.schemas import FeedResponse, PublicWish
from app.modules.discovery.service import DiscoveryService, SortOrder
from app.modules.identity.dependencies import (
    get_bearer_token,
    get_identity_service,
    require_active_auth,
)
from app.modules.identity.service import AuthContext, IdentityService

router = APIRouter(tags=["discovery"])


def get_optional_auth(
    request: Request,
    service: IdentityService = Depends(get_identity_service),
) -> AuthContext | None:
    if not request.headers.get("Authorization"):
        return None
    return service.authenticate(get_bearer_token(request))


def get_discovery_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> DiscoveryService:
    return DiscoveryService(settings=request.app.state.settings, session=session)


@router.get("/wishes", response_model=FeedResponse)
def list_wishes(
    city: str | None = Query(default=None, max_length=60),
    sort: SortOrder = Query(default="fresh"),
    cursor: str | None = Query(default=None, max_length=512),
    seed: str | None = Query(default=None, min_length=4, max_length=32),
    limit: int = Query(default=20, ge=1, le=50),
    auth: AuthContext | None = Depends(get_optional_auth),
    service: DiscoveryService = Depends(get_discovery_service),
) -> FeedResponse:
    return service.feed(
        viewer_id=auth.user.id if auth else None,
        city=city,
        sort=sort,
        cursor=cursor,
        limit=limit,
        seed=seed,
    )


@router.get("/wishes/{wish_id}", response_model=PublicWish)
def get_public_wish(
    wish_id: UUID,
    auth: AuthContext | None = Depends(get_optional_auth),
    service: DiscoveryService = Depends(get_discovery_service),
) -> PublicWish:
    return service.get_public(wish_id, auth.user.id if auth else None)


@router.post("/wishes/{wish_id}/select", response_model=PublicWish)
def select_wish(
    wish_id: UUID,
    auth: AuthContext = Depends(require_active_auth),
    service: DiscoveryService = Depends(get_discovery_service),
) -> PublicWish:
    return service.select(wish_id, auth.user.id)
