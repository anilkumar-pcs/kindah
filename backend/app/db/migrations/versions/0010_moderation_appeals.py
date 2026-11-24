"""moderation appeals

Revision ID: 0010_moderation_appeals
Revises: 0009_moderation_actions
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_moderation_appeals"
down_revision: str | None = "0009_moderation_actions"
branch_labels: str | None = None
depends_on: str | None = None

_STATUSES = ("OPEN", "UNDER_REVIEW", "ACCEPTED", "REJECTED")


def upgrade() -> None:
    bind = op.get_bind()
    status = postgresql.ENUM(*_STATUSES, name="appeal_status", create_type=False)
    status.create(bind, checkfirst=True)

    op.create_table(
        "moderation_appeals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("action_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", status, server_default=sa.text("'OPEN'"), nullable=False),
        sa.Column("reason_encrypted", sa.Text(), nullable=False),
        sa.Column("resolution_encrypted", sa.Text(), nullable=True),
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
            ["action_id"],
            ["moderation_actions.id"],
            name="fk_moderation_appeals_action",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_moderation_appeals_user",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["resolved_by"],
            ["users.id"],
            name="fk_moderation_appeals_resolver",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_moderation_appeals"),
        sa.UniqueConstraint("action_id", name="uq_moderation_appeals_action"),
    )
    op.create_index(
        "ix_moderation_appeals_status_created",
        "moderation_appeals",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_moderation_appeals_user_created",
        "moderation_appeals",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("moderation_appeals")
    bind = op.get_bind()
    postgresql.ENUM(name="appeal_status").drop(bind, checkfirst=True)
