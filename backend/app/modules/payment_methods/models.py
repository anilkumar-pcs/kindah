from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PaymentMethodStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class VpaValidationStatus(StrEnum):
    SYNTAX_ONLY = "SYNTAX_ONLY"
    PROVIDER_VALIDATED = "PROVIDER_VALIDATED"


class RecipientPaymentMethod(Base):
    __tablename__ = "recipient_payment_methods"
    __table_args__ = (CheckConstraint("version >= 1", name="ck_payment_methods_version"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    encrypted_vpa: Mapped[str] = mapped_column(Text, nullable=False)
    vpa_hmac: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    masked_vpa: Mapped[str] = mapped_column(String(80), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    status: Mapped[PaymentMethodStatus] = mapped_column(
        SAEnum(
            PaymentMethodStatus,
            name="payment_method_status",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        server_default=PaymentMethodStatus.ACTIVE.value,
    )
    validation_status: Mapped[VpaValidationStatus] = mapped_column(
        SAEnum(
            VpaValidationStatus,
            name="vpa_validation_status",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        server_default=VpaValidationStatus.SYNTAX_ONLY.value,
    )
    privacy_ack_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
