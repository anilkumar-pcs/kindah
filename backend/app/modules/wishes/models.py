from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class WishMood(StrEnum):
    CHAI_SNACK = "CHAI_SNACK"
    JUST_BECAUSE = "JUST_BECAUSE"
    LONG_DAY = "LONG_DAY"
    TINY_TREAT = "TINY_TREAT"


class WishStatus(StrEnum):
    OPEN = "OPEN"
    LOCKED = "LOCKED"
    PAYMENT_CLAIMED = "PAYMENT_CLAIMED"
    GRANTED = "GRANTED"
    UNVERIFIED = "UNVERIFIED"
    DISPUTED = "DISPUTED"
    EXPIRED = "EXPIRED"
    UNDER_REVIEW = "UNDER_REVIEW"
    REMOVED = "REMOVED"


class Wish(Base):
    __tablename__ = "wishes"
    __table_args__ = (
        CheckConstraint("char_length(message) BETWEEN 10 AND 120", name="ck_wishes_message"),
        CheckConstraint(
            "suggested_amount_inr IS NULL OR suggested_amount_inr BETWEEN 10 AND 100",
            name="ck_wishes_amount",
        ),
        CheckConstraint("expires_at > created_at", name="ck_wishes_expiry"),
        CheckConstraint(
            "city IS NULL OR char_length(city) BETWEEN 2 AND 60",
            name="ck_wishes_city",
        ),
        Index(
            "uq_wishes_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status IN ('OPEN', 'LOCKED')"),
        ),
        Index("ix_wishes_status_expires", "status", "expires_at"),
        Index("ix_wishes_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(String(120), nullable=False)
    mood: Mapped[WishMood] = mapped_column(
        SAEnum(
            WishMood,
            name="wish_mood",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
    )
    suggested_amount_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    city: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[WishStatus] = mapped_column(
        SAEnum(
            WishStatus,
            name="wish_status",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        server_default=WishStatus.OPEN.value,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cooldown_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_reason: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
