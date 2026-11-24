from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class UserBlock(Base):
    __tablename__ = "user_blocks"
    __table_args__ = (CheckConstraint("blocker_id <> blocked_id", name="ck_user_blocks_not_self"),)

    blocker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ReportTargetType(StrEnum):
    WISH = "WISH"
    USER = "USER"


class ReportReason(StrEnum):
    SPAM_BOT = "SPAM_BOT"
    HARASSMENT_ABUSE = "HARASSMENT_ABUSE"
    COMMERCIAL_SOLICITATION = "COMMERCIAL_SOLICITATION"
    INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT"
    IMPERSONATION = "IMPERSONATION"
    PAYMENT_MISDIRECTION = "PAYMENT_MISDIRECTION"
    OTHER = "OTHER"


class ReportStatus(StrEnum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACTIONED = "ACTIONED"
    DISMISSED = "DISMISSED"


class ModerationReport(Base):
    __tablename__ = "moderation_reports"
    __table_args__ = (
        UniqueConstraint(
            "reporter_id",
            "target_type",
            "target_id",
            name="uq_moderation_reports_reporter_target",
        ),
        Index("ix_moderation_reports_status_created", "status", "created_at"),
        Index("ix_moderation_reports_target", "target_type", "target_id"),
        Index("ix_moderation_reports_reporter_created", "reporter_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    target_type: Mapped[ReportTargetType] = mapped_column(
        SAEnum(
            ReportTargetType,
            name="report_target_type",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reason: Mapped[ReportReason] = mapped_column(
        SAEnum(
            ReportReason,
            name="report_reason",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
    )
    status: Mapped[ReportStatus] = mapped_column(
        SAEnum(
            ReportStatus,
            name="report_status",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        server_default=ReportStatus.OPEN.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SupportCaseType(StrEnum):
    LATE_PAYMENT = "LATE_PAYMENT"
    DONOR_CLAIM = "DONOR_CLAIM"
    RECIPIENT_DISPUTE = "RECIPIENT_DISPUTE"
    OTHER = "OTHER"


class SupportCaseStatus(StrEnum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class SupportCase(Base):
    __tablename__ = "support_cases"
    __table_args__ = (
        Index(
            "uq_support_open_case",
            "gift_id",
            "reporter_id",
            "case_type",
            unique=True,
            postgresql_where=text("status IN ('OPEN', 'UNDER_REVIEW')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    gift_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gifts.id", ondelete="RESTRICT"), nullable=False
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    case_type: Mapped[SupportCaseType] = mapped_column(
        SAEnum(
            SupportCaseType,
            name="support_case_type",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
    )
    status: Mapped[SupportCaseStatus] = mapped_column(
        SAEnum(
            SupportCaseStatus,
            name="support_case_status",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        server_default=SupportCaseStatus.OPEN.value,
    )
    description_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_note_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
