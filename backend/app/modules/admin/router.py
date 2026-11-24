from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.admin.schemas import (
    AdminAuditLogList,
    AdminMfaStatusResponse,
    MfaEnableRequest,
    MfaEnableResponse,
    MfaSetupResponse,
    MfaVerifyRequest,
    MfaVerifyResponse,
)
from app.modules.admin.service import AdminService
from app.modules.identity.dependencies import require_admin, require_admin_role
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


@router.get("/admin/audit-logs", response_model=AdminAuditLogList)
def list_audit_logs(
    _auth: AuthContext = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> AdminAuditLogList:
    return service.audit_logs()
