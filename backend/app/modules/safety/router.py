from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.identity.dependencies import require_active_auth, require_admin
from app.modules.identity.service import AuthContext
from app.modules.safety.models import SupportCaseStatus
from app.modules.safety.report_service import SafetyService
from app.modules.safety.schemas import (
    AdminSupportCaseList,
    AdminSupportCaseResponse,
    BlockedUserList,
    BlockedUserResponse,
    ReportCreateRequest,
    ReportResponse,
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


def get_safety_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> SafetyService:
    return SafetyService(
        settings=request.app.state.settings,
        session=session,
    )


@router.post(
    "/wishes/{wish_id}/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def report_wish(
    wish_id: UUID,
    body: ReportCreateRequest,
    response: Response,
    auth: AuthContext = Depends(require_active_auth),
    service: SafetyService = Depends(get_safety_service),
) -> ReportResponse:
    report, created = service.report_wish(auth.user, wish_id, body)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return report


@router.post(
    "/users/{user_id}/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def report_user(
    user_id: UUID,
    body: ReportCreateRequest,
    response: Response,
    auth: AuthContext = Depends(require_active_auth),
    service: SafetyService = Depends(get_safety_service),
) -> ReportResponse:
    report, created = service.report_user(auth.user, user_id, body)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return report


@router.post(
    "/users/{user_id}/block",
    response_model=BlockedUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def block_user(
    user_id: UUID,
    response: Response,
    auth: AuthContext = Depends(require_active_auth),
    service: SafetyService = Depends(get_safety_service),
) -> BlockedUserResponse:
    block, created = service.block_user(auth.user, user_id)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return block


@router.delete("/users/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
def unblock_user(
    user_id: UUID,
    auth: AuthContext = Depends(require_active_auth),
    service: SafetyService = Depends(get_safety_service),
) -> Response:
    service.unblock_user(auth.user, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/wishes/{wish_id}/block-owner",
    response_model=BlockedUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def block_wish_owner(
    wish_id: UUID,
    response: Response,
    auth: AuthContext = Depends(require_active_auth),
    service: SafetyService = Depends(get_safety_service),
) -> BlockedUserResponse:
    block, created = service.block_wish_owner(auth.user, wish_id)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return block


@router.delete("/wishes/{wish_id}/block-owner", status_code=status.HTTP_204_NO_CONTENT)
def unblock_wish_owner(
    wish_id: UUID,
    auth: AuthContext = Depends(require_active_auth),
    service: SafetyService = Depends(get_safety_service),
) -> Response:
    service.unblock_wish_owner(auth.user, wish_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/blocks", response_model=BlockedUserList)
def list_blocks(
    auth: AuthContext = Depends(require_active_auth),
    service: SafetyService = Depends(get_safety_service),
) -> BlockedUserList:
    return service.list_blocks(auth.user)


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
