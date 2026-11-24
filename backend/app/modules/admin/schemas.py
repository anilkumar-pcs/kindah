from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from app.core.schemas import ApiModel
from app.modules.identity.models import UserRole


class AdminMfaStatusResponse(ApiModel):
    role: UserRole
    mfa_enabled: bool
    mfa_required: bool
    recovery_codes_remaining: int


class MfaSetupResponse(ApiModel):
    secret: str
    otpauth_uri: str


class MfaEnableRequest(ApiModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class MfaEnableResponse(ApiModel):
    mfa_enabled: bool
    mfa_token: str
    expires_in: int
    recovery_codes: list[str]


class MfaVerifyRequest(ApiModel):
    code: str = Field(min_length=6, max_length=32)


class MfaVerifyResponse(ApiModel):
    mfa_token: str
    expires_in: int
    method: Literal["TOTP", "RECOVERY"]


class UserModerationActionRequest(ApiModel):
    action: Literal["WARN", "RESTRICT", "SUSPEND", "BAN", "REACTIVATE"]
    reason: str = Field(min_length=5, max_length=1000)


class WishModerationActionRequest(ApiModel):
    action: Literal["HIDE", "RESTORE", "REMOVE"]
    reason: str = Field(min_length=5, max_length=1000)


class ModerationActionResponse(ApiModel):
    id: UUID
    target_type: Literal["USER", "WISH"]
    target_id: UUID
    action: str
    reason: str
    moderator_display_name: str | None
    created_at: datetime


class AdminAuditLogResponse(ApiModel):
    id: UUID
    actor_display_name: str | None
    action: str
    target_type: str
    target_id: UUID | None
    reason: str | None
    request_id: str | None
    metadata: dict[str, Any]
    created_at: datetime


class AdminAuditLogList(ApiModel):
    logs: list[AdminAuditLogResponse]
