"""moderation reports

Revision ID: 0007_moderation_reports
Revises: 0006_support_cases
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_moderation_reports"
down_revision: str | None = "0006_support_cases"
branch_labels: str | None = None
depends_on: str | None = None

_TARGET_TYPES = ("WISH", "USER")
_REASONS = (
    "SPAM_BOT",
    "HARASSMENT_ABUSE",
    "COMMERCIAL_SOLICITATION",
    "INAPPROPRIATE_CONTENT",
    "IMPERSONATION",
    "PAYMENT_MISDIRECTION",
    "OTHER",
)
_STATUSES = ("OPEN", "UNDER_REVIEW", "ACTIONED", "DISMISSED")


def upgrade() -> None:
    bind = op.get_bind()
    target_type = postgresql.ENUM(*_TARGET_TYPES, name="report_target_type", create_type=False)
    reason = postgresql.ENUM(*_REASONS, name="report_reason", create_type=False)
    status = postgresql.ENUM(*_STATUSES, name="report_status", create_type=False)
    target_type.create(bind, checkfirst=True)
    reason.create(bind, checkfirst=True)
    status.create(bind, checkfirst=True)

    op.create_table(
        "moderation_reports",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", target_type, nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", reason, nullable=False),
        sa.Column("status", status, server_default=sa.text("'OPEN'"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
            name="fk_moderation_reports_reporter",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_moderation_reports"),
        sa.UniqueConstraint(
            "reporter_id",
            "target_type",
            "target_id",
            name="uq_moderation_reports_reporter_target",
        ),
    )
    op.create_index(
        "ix_moderation_reports_status_created",
        "moderation_reports",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_moderation_reports_target",
        "moderation_reports",
        ["target_type", "target_id"],
    )
    op.create_index(
        "ix_moderation_reports_reporter_created",
        "moderation_reports",
        ["reporter_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("moderation_reports")
    bind = op.get_bind()
    for name in ("report_status", "report_reason", "report_target_type"):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
