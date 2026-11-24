from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.core.schemas import ApiModel
from app.modules.admin.models import AppealStatus, DeletionRequestStatus
from app.modules.identity.models import UserRole, UserStatus


class AdminUserSummary(ApiModel):
    id: UUID
    display_name: str | None
    role: UserRole
    status: UserStatus
    created_at: datetime


class AdminUserList(ApiModel):
    users: list[AdminUserSummary]


class UserRoleUpdateRequest(ApiModel):
    role: UserRole
    reason: str = Field(min_length=5, max_length=1000)


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


class ModerationActionSummaryResponse(ApiModel):
    id: UUID
    action: str
    reason: str
    appeal_status: AppealStatus | None
    can_appeal: bool
    created_at: datetime


class ModerationActionList(ApiModel):
    actions: list[ModerationActionSummaryResponse]


class AppealCreateRequest(ApiModel):
    reason: str = Field(min_length=10, max_length=1000)


class AppealResponse(ApiModel):
    id: UUID
    action_id: UUID
    status: AppealStatus
    reason: str
    resolution_note: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class AppealList(ApiModel):
    appeals: list[AppealResponse]


class AdminAppealResponse(ApiModel):
    id: UUID
    action_id: UUID
    user_display_name: str | None
    action: str
    action_reason: str
    target_type: str
    target_id: UUID
    status: AppealStatus
    reason: str
    resolution_note: str | None
    resolved_by_display_name: str | None
    created_at: datetime
    resolved_at: datetime | None


class AdminAppealList(ApiModel):
    appeals: list[AdminAppealResponse]


class AppealResolveRequest(ApiModel):
    outcome: Literal["ACCEPTED", "REJECTED"]
    resolution_note: str = Field(min_length=5, max_length=1000)


class DeletionRequestCreate(ApiModel):
    reason: str | None = Field(default=None, max_length=500)


class DeletionRequestResponse(ApiModel):
    id: UUID
    status: DeletionRequestStatus
    reason: str | None
    requested_at: datetime
    cancelled_at: datetime | None


class AdminDeletionRequestResponse(ApiModel):
    id: UUID
    user_display_name: str | None
    user_status: UserStatus
    status: DeletionRequestStatus
    reason: str | None
    requested_at: datetime
    cancelled_at: datetime | None


class AdminDeletionRequestList(ApiModel):
    requests: list[AdminDeletionRequestResponse]


class OutboxDeadLetterResponse(ApiModel):
    id: UUID
    aggregate_type: str
    aggregate_id: UUID
    event_type: str
    payload: dict[str, Any]
    attempts: int
    dead_letter_reason: str | None
    created_at: datetime


class OutboxDeadLetterList(ApiModel):
    dead_letters: list[OutboxDeadLetterResponse]


BadgeRuleType = Literal["CONFIRMED_SENT", "THANKS_RECEIVED", "STREAK_DAYS"]


class BadgeDefinitionResponse(ApiModel):
    code: str
    label: str
    rule_type: BadgeRuleType
    threshold: int
    active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class BadgeDefinitionList(ApiModel):
    badges: list[BadgeDefinitionResponse]


class BadgeDefinitionCreate(ApiModel):
    code: str = Field(min_length=3, max_length=32, pattern=r"^[A-Z][A-Z0-9_]+$")
    label: str = Field(min_length=2, max_length=64)
    rule_type: BadgeRuleType
    threshold: int = Field(ge=1, le=1000)
    active: bool = True
    sort_order: int = Field(default=0, ge=0, le=1000)


class BadgeDefinitionUpdate(ApiModel):
    label: str | None = Field(default=None, min_length=2, max_length=64)
    rule_type: BadgeRuleType | None = None
    threshold: int | None = Field(default=None, ge=1, le=1000)
    active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1000)

    @model_validator(mode="after")
    def at_least_one_field(self) -> BadgeDefinitionUpdate:
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self


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
