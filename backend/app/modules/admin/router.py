from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.admin.models import AppealStatus, DeletionRequestStatus
from app.modules.admin.schemas import (
    AdminAppealList,
    AdminAppealResponse,
    AdminAuditLogList,
    AdminDeletionRequestList,
    AdminMfaStatusResponse,
    AdminUserList,
    AdminUserSummary,
    AppealCreateRequest,
    AppealList,
    AppealResolveRequest,
    AppealResponse,
    BadgeDefinitionCreate,
    BadgeDefinitionList,
    BadgeDefinitionResponse,
    BadgeDefinitionUpdate,
    DeletionRequestCreate,
    DeletionRequestResponse,
    MfaEnableRequest,
    MfaEnableResponse,
    MfaSetupResponse,
    MfaVerifyRequest,
    MfaVerifyResponse,
    ModerationActionList,
    ModerationActionResponse,
    OutboxDeadLetterList,
    UserModerationActionRequest,
    UserRoleUpdateRequest,
    WishModerationActionRequest,
)
from app.modules.admin.service import AdminService
from app.modules.identity.dependencies import (
    get_current_auth,
    require_admin,
    require_admin_role,
)
from app.modules.identity.service import AuthContext
from app.providers.crypto.base import CryptoProvider

router = APIRouter(tags=["admin"])


def get_admin_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> AdminService:
    crypto: CryptoProvider = request.app.state.crypto
    return AdminService(
        settings=request.app.state.settings,
        session=session,
        crypto=crypto,
    )


@router.get("/admin/mfa/status", response_model=AdminMfaStatusResponse)
def mfa_status(
    auth: AuthContext = Depends(require_admin_role),
    service: AdminService = Depends(get_admin_service),
) -> AdminMfaStatusResponse:
    return service.mfa_status(auth.user)


@router.post("/admin/mfa/setup", response_model=MfaSetupResponse)
def setup_mfa(
    auth: AuthContext = Depends(require_admin_role),
    service: AdminService = Depends(get_admin_service),
) -> MfaSetupResponse:
    return service.setup_mfa(auth.user)


@router.post("/admin/mfa/enable", response_model=MfaEnableResponse)
def enable_mfa(
    body: MfaEnableRequest,
    auth: AuthContext = Depends(require_admin_role),
    service: AdminService = Depends(get_admin_service),
) -> MfaEnableResponse:
    return service.enable_mfa(auth.user, auth.session.id, body.code)


@router.post("/admin/mfa/verify", response_model=MfaVerifyResponse)
def verify_mfa(
    body: MfaVerifyRequest,
    auth: AuthContext = Depends(require_admin_role),
    service: AdminService = Depends(get_admin_service),
) -> MfaVerifyResponse:
    return service.verify_mfa(auth.user, auth.session.id, body.code)


@router.get("/admin/badges", response_model=BadgeDefinitionList)
def list_badge_definitions(
    _auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> BadgeDefinitionList:
    return service.list_badge_definitions()


@router.post("/admin/badges", response_model=BadgeDefinitionResponse, status_code=201)
def create_badge_definition(
    body: BadgeDefinitionCreate,
    auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> BadgeDefinitionResponse:
    return service.create_badge_definition(auth.user, body)


@router.patch("/admin/badges/{code}", response_model=BadgeDefinitionResponse)
def update_badge_definition(
    code: str,
    body: BadgeDefinitionUpdate,
    auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> BadgeDefinitionResponse:
    return service.update_badge_definition(auth.user, code, body)


@router.delete("/admin/badges/{code}", response_model=BadgeDefinitionResponse)
def deactivate_badge_definition(
    code: str,
    auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> BadgeDefinitionResponse:
    return service.deactivate_badge_definition(auth.user, code)


@router.get("/admin/users", response_model=AdminUserList)
def list_users(
    query: str | None = Query(default=None, max_length=60),
    _auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> AdminUserList:
    return service.list_users(query)


@router.patch("/admin/users/{user_id}/role", response_model=AdminUserSummary)
def set_user_role(
    user_id: UUID,
    body: UserRoleUpdateRequest,
    auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> AdminUserSummary:
    return service.set_user_role(auth.user, user_id, body)


@router.post(
    "/admin/users/{user_id}/actions",
    response_model=ModerationActionResponse,
)
def moderate_user(
    user_id: UUID,
    body: UserModerationActionRequest,
    auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> ModerationActionResponse:
    return service.moderate_user(auth.user, user_id, body)


@router.post(
    "/admin/wishes/{wish_id}/actions",
    response_model=ModerationActionResponse,
)
def moderate_wish(
    wish_id: UUID,
    body: WishModerationActionRequest,
    auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> ModerationActionResponse:
    return service.moderate_wish(auth.user, wish_id, body)


@router.get("/me/moderation-actions", response_model=ModerationActionList)
def list_my_moderation_actions(
    auth: AuthContext = Depends(get_current_auth),
    service: AdminService = Depends(get_admin_service),
) -> ModerationActionList:
    return service.list_my_actions(auth.user)


@router.post(
    "/me/moderation-actions/{action_id}/appeals",
    response_model=AppealResponse,
    status_code=201,
)
def create_appeal(
    action_id: UUID,
    body: AppealCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    service: AdminService = Depends(get_admin_service),
) -> AppealResponse:
    return service.create_appeal(auth.user, action_id, body)


@router.get("/me/appeals", response_model=AppealList)
def list_my_appeals(
    auth: AuthContext = Depends(get_current_auth),
    service: AdminService = Depends(get_admin_service),
) -> AppealList:
    return service.list_my_appeals(auth.user)


@router.get("/admin/appeals", response_model=AdminAppealList)
def list_admin_appeals(
    status: AppealStatus | None = Query(default=AppealStatus.OPEN),
    _admin: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> AdminAppealList:
    return service.list_admin_appeals(status)


@router.post(
    "/admin/appeals/{appeal_id}/resolve",
    response_model=AdminAppealResponse,
)
def resolve_appeal(
    appeal_id: UUID,
    body: AppealResolveRequest,
    auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> AdminAppealResponse:
    return service.resolve_appeal(auth.user, appeal_id, body)


@router.get("/me/deletion-request", response_model=DeletionRequestResponse)
def get_deletion_request(
    auth: AuthContext = Depends(get_current_auth),
    service: AdminService = Depends(get_admin_service),
) -> DeletionRequestResponse:
    return service.get_deletion_request(auth.user)


@router.post("/me/deletion-request", response_model=DeletionRequestResponse)
def request_deletion(
    body: DeletionRequestCreate,
    auth: AuthContext = Depends(get_current_auth),
    service: AdminService = Depends(get_admin_service),
) -> DeletionRequestResponse:
    return service.request_deletion(auth.user, body)


@router.delete("/me/deletion-request", response_model=DeletionRequestResponse)
def cancel_deletion(
    auth: AuthContext = Depends(get_current_auth),
    service: AdminService = Depends(get_admin_service),
) -> DeletionRequestResponse:
    return service.cancel_deletion(auth.user)


@router.get("/admin/deletion-requests", response_model=AdminDeletionRequestList)
def list_admin_deletion_requests(
    status: DeletionRequestStatus | None = Query(default=DeletionRequestStatus.REQUESTED),
    _admin: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> AdminDeletionRequestList:
    return service.list_admin_deletion_requests(status)


@router.get("/admin/outbox/dead-letters", response_model=OutboxDeadLetterList)
def list_outbox_dead_letters(
    _auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> OutboxDeadLetterList:
    return service.list_outbox_dead_letters()


@router.get("/admin/audit-logs", response_model=AdminAuditLogList)
def list_audit_logs(
    _auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> AdminAuditLogList:
    return service.audit_logs()
