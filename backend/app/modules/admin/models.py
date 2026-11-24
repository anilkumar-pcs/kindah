from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ModerationTargetType(StrEnum):
    USER = "USER"
    WISH = "WISH"


class ModerationActionType(StrEnum):
    WARN = "WARN"
    RESTRICT = "RESTRICT"
    SUSPEND = "SUSPEND"
    BAN = "BAN"
    REACTIVATE = "REACTIVATE"
    HIDE = "HIDE"
    RESTORE = "RESTORE"
    REMOVE = "REMOVE"


class AppealStatus(StrEnum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class ModerationAction(Base):
    __tablename__ = "moderation_actions"
    __table_args__ = (
        Index("ix_moderation_actions_moderator_created", "moderator_id", "created_at"),
        Index("ix_moderation_actions_target", "target_type", "target_id"),
        Index("ix_moderation_actions_action_created", "action", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    moderator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    target_type: Mapped[ModerationTargetType] = mapped_column(
        SAEnum(
            ModerationTargetType,
            name="moderation_target_type",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[ModerationActionType] = mapped_column(
        SAEnum(
            ModerationActionType,
            name="moderation_action_type",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
    )
    reason_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ModerationAppeal(Base):
    __tablename__ = "moderation_appeals"
    __table_args__ = (
        Index("ix_moderation_appeals_status_created", "status", "created_at"),
        Index("ix_moderation_appeals_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    action_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("moderation_actions.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[AppealStatus] = mapped_column(
        SAEnum(
            AppealStatus,
            name="appeal_status",
            native_enum=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        server_default=AppealStatus.OPEN.value,
    )
    reason_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
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


class AdminAuditLog(Base):
    """Append-only administrative audit trail.

    There are deliberately no update/delete endpoints; the migration also
    installs a database trigger that rejects row mutation.
    """

    __tablename__ = "admin_audit_logs"
    __table_args__ = (
        Index("ix_admin_audit_logs_actor_created", "actor_id", "created_at"),
        Index("ix_admin_audit_logs_action_created", "action", "created_at"),
        Index("ix_admin_audit_logs_target", "target_type", "target_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(48), nullable=False)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reason_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_metadata: Mapped[dict[str, object]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
