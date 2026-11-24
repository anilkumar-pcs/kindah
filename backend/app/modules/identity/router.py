from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.identity.dependencies import (
    CSRF_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    get_client_ip,
    get_current_auth,
    get_identity_service,
    get_user_agent,
    require_active_auth,
    require_csrf,
)
from app.modules.identity.schemas import (
    ConsentRequest,
    OtpRequest,
    OtpRequestResponse,
    OtpVerifyRequest,
    ProfileUpdateRequest,
    SessionResponse,
    UserProfileResponse,
)
from app.modules.identity.service import AuthContext, IdentityService, SessionTokens

router = APIRouter()

_REFRESH_COOKIE_PATH = "/api/v1/auth"
_CSRF_COOKIE_PATH = "/"


def _set_session_cookies(
    response: Response,
    tokens: SessionTokens,
    settings: Settings,
) -> None:
    max_age = settings.refresh_token_ttl_days * 24 * 60 * 60
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=tokens.refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=_REFRESH_COOKIE_PATH,
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=tokens.csrf_token,
        max_age=max_age,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path=_CSRF_COOKIE_PATH,
    )


def _clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=_REFRESH_COOKIE_PATH,
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        key=CSRF_COOKIE_NAME,
        path=_CSRF_COOKIE_PATH,
        secure=settings.cookie_secure,
        httponly=False,
        samesite="lax",
    )


@router.post(
    "/auth/otp/request",
    response_model=OtpRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["identity"],
)
def request_otp(
    body: OtpRequest,
    request: Request,
    service: IdentityService = Depends(get_identity_service),
) -> OtpRequestResponse:
    return service.request_otp(body.phone, get_client_ip(request))


@router.post(
    "/auth/otp/verify",
    response_model=SessionResponse,
    tags=["identity"],
)
def verify_otp(
    body: OtpVerifyRequest,
    request: Request,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionResponse:
    tokens = service.verify_otp(
        body.phone,
        body.code,
        get_client_ip(request),
        get_user_agent(request),
    )
    _set_session_cookies(response, tokens, service.settings)
    return SessionResponse(
        access_token=tokens.access_token,
        token_type="Bearer",
        expires_in=tokens.expires_in,
        user=service.profile(tokens.user),
    )


@router.post(
    "/auth/refresh",
    response_model=SessionResponse,
    dependencies=[Depends(require_csrf)],
    tags=["identity"],
)
def refresh_session(
    request: Request,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise AppError(
            401,
            "AUTH_REQUIRED",
            "Sign in required",
            "No refresh session was found.",
        )
    tokens = service.refresh_session(
        refresh_token,
        get_client_ip(request),
        get_user_agent(request),
    )
    _set_session_cookies(response, tokens, service.settings)
    return SessionResponse(
        access_token=tokens.access_token,
        token_type="Bearer",
        expires_in=tokens.expires_in,
        user=service.profile(tokens.user),
    )


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_csrf)],
    tags=["identity"],
)
def logout(
    request: Request,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> Response:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token:
        service.logout(refresh_token, get_client_ip(request))
    _clear_session_cookies(response, service.settings)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get(
    "/me",
    response_model=UserProfileResponse,
    tags=["profile"],
)
def get_me(
    auth: AuthContext = Depends(get_current_auth),
    service: IdentityService = Depends(get_identity_service),
) -> UserProfileResponse:
    return service.profile(auth.user)


@router.post(
    "/me/consent",
    response_model=UserProfileResponse,
    tags=["profile"],
)
def record_consent(
    body: ConsentRequest,
    auth: AuthContext = Depends(require_active_auth),
    service: IdentityService = Depends(get_identity_service),
) -> UserProfileResponse:
    user = service.record_consent(auth.user, body)
    return service.profile(user)


@router.patch(
    "/me",
    response_model=UserProfileResponse,
    tags=["profile"],
)
def update_me(
    body: ProfileUpdateRequest,
    auth: AuthContext = Depends(require_active_auth),
    service: IdentityService = Depends(get_identity_service),
) -> UserProfileResponse:
    user = service.update_profile(auth.user, body)
    return service.profile(user)
