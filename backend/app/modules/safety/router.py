from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.identity.dependencies import require_active_auth, require_admin
from app.modules.identity.service import AuthContext
from app.modules.safety.models import SupportCaseStatus
from app.modules.safety.schemas import (
    AdminSupportCaseList,
    AdminSupportCaseResponse,
    SupportCaseCreateRequest,
    SupportCaseResolveRequest,
    SupportCaseResponse,
)
from app.modules.safety.support_service import SupportCaseService
from app.providers.crypto.base import CryptoProvider

router = APIRouter(tags=["support"])


def get_support_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> SupportCaseService:
    crypto: CryptoProvider = request.app.state.crypto
    return SupportCaseService(
        settings=request.app.state.settings,
        session=session,
        crypto=crypto,
    )


@router.post(
    "/gifts/{gift_id}/support-cases",
    response_model=SupportCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_support_case(
    gift_id: UUID,
    body: SupportCaseCreateRequest,
    auth: AuthContext = Depends(require_active_auth),
    service: SupportCaseService = Depends(get_support_service),
) -> SupportCaseResponse:
    return service.create(auth.user, gift_id, body)


@router.get(
    "/admin/support-cases",
    response_model=AdminSupportCaseList,
)
def list_support_cases(
    status: SupportCaseStatus | None = Query(default=None),
    _admin: AuthContext = Depends(require_admin),
    service: SupportCaseService = Depends(get_support_service),
) -> AdminSupportCaseList:
    return AdminSupportCaseList(cases=service.list_admin(status))


@router.post(
    "/admin/support-cases/{case_id}/resolve",
    response_model=AdminSupportCaseResponse,
)
def resolve_support_case(
    case_id: UUID,
    body: SupportCaseResolveRequest,
    admin: AuthContext = Depends(require_admin),
    service: SupportCaseService = Depends(get_support_service),
) -> AdminSupportCaseResponse:
    return service.resolve(admin.user, case_id, body)
