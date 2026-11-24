from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.core.schemas import ApiModel
from app.modules.gifts.models import GiftStatus
from app.modules.safety.models import (
    ReportReason,
    ReportStatus,
    ReportTargetType,
    SupportCaseStatus,
    SupportCaseType,
)
from app.modules.wishes.models import WishStatus


class SupportCaseCreateRequest(ApiModel):
    case_type: Literal["LATE_PAYMENT", "DONOR_CLAIM", "RECIPIENT_DISPUTE", "OTHER"]
    description: str = Field(min_length=10, max_length=1000)


class SupportCaseResponse(ApiModel):
    id: UUID
    case_type: SupportCaseType
    status: SupportCaseStatus
    created_at: datetime
    updated_at: datetime


class AdminSupportCaseResponse(ApiModel):
    id: UUID
    gift_id: UUID
    wish_id: UUID
    case_type: SupportCaseType
    status: SupportCaseStatus
    description: str
    reporter_display_name: str | None
    donor_display_name: str | None
    recipient_display_name: str | None
    amount_inr: int
    gift_status: GiftStatus
    wish_status: WishStatus
    payment_ref_code: str
    recipient_masked_vpa: str | None
    utr_reference: str | None
    resolution_note: str | None
    resolved_at: datetime | None
    created_at: datetime


class ReportCreateRequest(ApiModel):
    reason: ReportReason


class ReportResponse(ApiModel):
    id: UUID
    target_type: ReportTargetType
    target_id: UUID
    reason: ReportReason
    status: ReportStatus
    created_at: datetime


class BlockedUserResponse(ApiModel):
    blocked_user_id: UUID
    display_name: str | None
    created_at: datetime


class BlockedUserList(ApiModel):
    blocked_users: list[BlockedUserResponse]


class AdminSupportCaseList(ApiModel):
    cases: list[AdminSupportCaseResponse]


class SupportCaseResolveRequest(ApiModel):
    resolution_note: str = Field(min_length=5, max_length=1000)
