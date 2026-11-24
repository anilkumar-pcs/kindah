"""configurable badge definitions

Revision ID: 0014_badge_definitions
Revises: 0013_user_badges
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0014_badge_definitions"
down_revision: str | None = "0013_user_badges"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "badge_definitions",
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("rule_type", sa.String(length=32), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
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
        sa.PrimaryKeyConstraint("code", name="pk_badge_definitions"),
    )
    definitions = sa.table(
        "badge_definitions",
        sa.column("code", sa.String),
        sa.column("label", sa.String),
        sa.column("rule_type", sa.String),
        sa.column("threshold", sa.Integer),
        sa.column("active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        definitions,
        [
            {
                "code": "FIRST_GIFT",
                "label": "First gift",
                "rule_type": "CONFIRMED_SENT",
                "threshold": 1,
                "active": True,
                "sort_order": 10,
            },
            {
                "code": "KIND_HEART",
                "label": "Kind heart",
                "rule_type": "CONFIRMED_SENT",
                "threshold": 5,
                "active": True,
                "sort_order": 20,
            },
            {
                "code": "KIND_SOUL",
                "label": "Kind soul",
                "rule_type": "CONFIRMED_SENT",
                "threshold": 10,
                "active": True,
                "sort_order": 30,
            },
            {
                "code": "GRATEFUL",
                "label": "Grateful",
                "rule_type": "THANKS_RECEIVED",
                "threshold": 1,
                "active": True,
                "sort_order": 40,
            },
            {
                "code": "STREAK_3",
                "label": "Three-day streak",
                "rule_type": "STREAK_DAYS",
                "threshold": 3,
                "active": True,
                "sort_order": 50,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("badge_definitions")
