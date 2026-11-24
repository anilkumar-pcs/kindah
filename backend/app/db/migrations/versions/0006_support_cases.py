"""support cases and admin resolution

Revision ID: 0006_support_cases
Revises: 0005_gifts
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_support_cases"
down_revision: str | None = "0005_gifts"
branch_labels: str | None = None
depends_on: str | None = None

_CASE_TYPES = ("LATE_PAYMENT", "DONOR_CLAIM", "RECIPIENT_DISPUTE", "OTHER")
_CASE_STATUSES = ("OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED")


def upgrade() -> None:
    bind = op.get_bind()
    case_type = postgresql.ENUM(*_CASE_TYPES, name="support_case_type", create_type=False)
    case_status = postgresql.ENUM(*_CASE_STATUSES, name="support_case_status", create_type=False)
    case_type.create(bind, checkfirst=True)
    case_status.create(bind, checkfirst=True)

    op.create_table(
        "support_cases",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("gift_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_type", case_type, nullable=False),
        sa.Column("status", case_status, server_default=sa.text("'OPEN'"), nullable=False),
        sa.Column("description_encrypted", sa.Text(), nullable=False),
        sa.Column("resolution_note_encrypted", sa.Text(), nullable=True),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
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
            ["gift_id"], ["gifts.id"], name="fk_support_cases_gift", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
            name="fk_support_cases_reporter",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["resolved_by"],
            ["users.id"],
            name="fk_support_cases_resolver",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_support_cases"),
    )
    op.create_index(
        "uq_support_open_case",
        "support_cases",
        ["gift_id", "reporter_id", "case_type"],
        unique=True,
        postgresql_where=sa.text("status IN ('OPEN', 'UNDER_REVIEW')"),
    )


def downgrade() -> None:
    op.drop_table("support_cases")
    bind = op.get_bind()
    for name in ("support_case_status", "support_case_type"):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
