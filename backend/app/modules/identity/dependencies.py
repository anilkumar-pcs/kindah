from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.core.errors import AppError
from app.core.security import TokenError, constant_time_equals, decode_mfa_token
from app.modules.admin.rbac import has_admin_access
from app.modules.identity.models import UserStatus
from app.modules.identity.service import AuthContext, IdentityService
from app.providers.crypto.base import CryptoProvider
from app.providers.sms.base import SmsProvider

REFRESH_COOKIE_NAME = "kindly_refresh"
CSRF_COOKIE_NAME = "kindly_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"
ADMIN_MFA_HEADER_NAME = "X-Admin-MFA"


def get_identity_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> IdentityService:
    settings = request.app.state.settings
    crypto: CryptoProvider = request.app.state.crypto
    sms: SmsProvider = request.app.state.sms
    return IdentityService(
        settings=settings,
        session=session,
        crypto=crypto,
        sms=sms,
    )


def get_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    parts = header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise AppError(
            401,
            "AUTH_REQUIRED",
            "Sign in required",
            "Authentication is required for this action.",
        )
    return parts[1]


def get_current_auth(
    request: Request,
    service: IdentityService = Depends(get_identity_service),
) -> AuthContext:
    return service.authenticate(get_bearer_token(request))


def require_active_auth(
    auth: AuthContext = Depends(get_current_auth),
) -> AuthContext:
    if auth.user.status != UserStatus.ACTIVE:
        raise AppError(
            403,
            "ACCOUNT_RESTRICTED",
            "Account restricted",
            "This account cannot perform this action.",
        )
    return auth


def require_admin_role(
    request: Request,
    auth: AuthContext = Depends(require_active_auth),
) -> AuthContext:
    if not has_admin_access(auth.user):
        raise AppError(
            403,
            "FORBIDDEN",
            "Admin access required",
            "This action requires a moderator or administrator account.",
        )
    return auth


def require_admin(
    request: Request,
    auth: AuthContext = Depends(require_admin_role),
) -> AuthContext:
    settings = request.app.state.settings
    if auth.user.mfa_enabled_at is None:
        raise AppError(
            403,
            "MFA_SETUP_REQUIRED",
            "MFA setup required",
            "Set up authenticator MFA before using the admin area.",
        )
    token = request.headers.get(ADMIN_MFA_HEADER_NAME)
    if not token:
        raise AppError(
            403,
            "MFA_REQUIRED",
            "MFA verification required",
            "Verify an authenticator code before using the admin area.",
        )
    try:
        claims = decode_mfa_token(settings, token)
    except TokenError as exc:
        raise AppError(
            403,
            "MFA_REQUIRED",
            "MFA verification required",
            "The admin MFA token is invalid or expired.",
        ) from exc
    if claims.user_id != str(auth.user.id) or claims.session_id != str(auth.session.id):
        raise AppError(
            403,
            "MFA_REQUIRED",
            "MFA verification required",
            "The admin MFA token does not match this session.",
        )
    return auth


def require_csrf(request: Request) -> None:
    header = request.headers.get(CSRF_HEADER_NAME)
    cookie = request.cookies.get(CSRF_COOKIE_NAME)
    if not header or not cookie or not constant_time_equals(header, cookie):
        raise AppError(
            403,
            "FORBIDDEN",
            "Request verification failed",
            "Refresh the page and try again.",
        )


def get_client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("User-Agent")
