from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, StrictInt

from app.core.schemas import ApiModel
from app.modules.gifts.models import GiftStatus
from app.modules.wishes.models import WishStatus


class GiftCreateRequest(ApiModel):
    wish_id: UUID
    amount_inr: StrictInt = Field(ge=10, le=100)
    cheer_note: str | None = Field(default=None, max_length=80)


class DonorOutcomeRequest(ApiModel):
    outcome: Literal["PAID", "STILL_PROCESSING", "FAILED"]
    utr_reference: str | None = Field(default=None, max_length=64)


class RecipientConfirmationRequest(ApiModel):
    outcome: Literal["RECEIVED", "NOT_RECEIVED"]
    reaction: Literal["HEART", "PRAY", "SMILE"] | None = None
    message: str | None = Field(default=None, max_length=120)


class GiftResponse(ApiModel):
    gift_id: UUID
    wish_id: UUID
    gift_status: GiftStatus
    wish_status: WishStatus
    viewer_role: Literal["DONOR", "RECIPIENT"]
    amount_inr: int
    payment_ref_code: str
    upi_intent_uri: str | None = None
    qr_payload: str | None = None
    reservation_expires_at: datetime | None = None
    recipient_response_deadline: datetime | None = None
    recipient_display_name: str | None = None
    created_at: datetime


class GiftListResponse(ApiModel):
    gifts: list[GiftResponse]
