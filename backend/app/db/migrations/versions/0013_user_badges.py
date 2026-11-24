"""user badges

Revision ID: 0013_user_badges
Revises: 0012_notifications
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013_user_badges"
down_revision: str | None = "0012_notifications"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "user_badges",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("badge_code", sa.String(length=32), nullable=False),
        sa.Column(
            "unlocked_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_badges_user",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_badges"),
        sa.UniqueConstraint("user_id", "badge_code", name="uq_user_badges_user_code"),
    )
    op.create_index("ix_user_badges_user", "user_badges", ["user_id"])


def downgrade() -> None:
    op.drop_table("user_badges")
