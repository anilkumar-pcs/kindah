from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.core.schemas import ApiModel
from app.modules.payment_methods.models import PaymentMethodStatus, VpaValidationStatus


class PaymentMethodUpdateRequest(ApiModel):
    vpa: str = Field(min_length=3, max_length=80)
    privacy_acknowledged: bool


class PaymentMethodResponse(ApiModel):
    masked_vpa: str
    version: int
    status: PaymentMethodStatus
    validation_status: VpaValidationStatus
    privacy_ack_at: datetime
    updated_at: datetime
