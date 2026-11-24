"""discovery support: user blocks and feed index

Revision ID: 0004_discovery
Revises: 0003_payment_wishes
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_discovery"
down_revision: str | None = "0003_payment_wishes"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "user_blocks",
        sa.Column("blocker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("blocker_id <> blocked_id", name="ck_user_blocks_not_self"),
        sa.ForeignKeyConstraint(
            ["blocker_id"],
            ["users.id"],
            name="fk_user_blocks_blocker",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["blocked_id"],
            ["users.id"],
            name="fk_user_blocks_blocked",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("blocker_id", "blocked_id", name="pk_user_blocks"),
    )
    op.create_index(
        "ix_wishes_status_created_at",
        "wishes",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_wishes_status_created_at", table_name="wishes")
    op.drop_table("user_blocks")
