"""moderation actions

Revision ID: 0009_moderation_actions
Revises: 0008_admin_rbac_mfa
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_moderation_actions"
down_revision: str | None = "0008_admin_rbac_mfa"
branch_labels: str | None = None
depends_on: str | None = None

_TARGET_TYPES = ("USER", "WISH")
_ACTIONS = ("WARN", "RESTRICT", "SUSPEND", "BAN", "REACTIVATE", "HIDE", "RESTORE", "REMOVE")


def upgrade() -> None:
    bind = op.get_bind()
    target_type = postgresql.ENUM(*_TARGET_TYPES, name="moderation_target_type", create_type=False)
    action_type = postgresql.ENUM(*_ACTIONS, name="moderation_action_type", create_type=False)
    target_type.create(bind, checkfirst=True)
    action_type.create(bind, checkfirst=True)

    op.create_table(
        "moderation_actions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("moderator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", target_type, nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", action_type, nullable=False),
        sa.Column("reason_encrypted", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["moderator_id"],
            ["users.id"],
            name="fk_moderation_actions_moderator",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_moderation_actions"),
    )
    op.create_index(
        "ix_moderation_actions_moderator_created",
        "moderation_actions",
        ["moderator_id", "created_at"],
    )
    op.create_index(
        "ix_moderation_actions_target",
        "moderation_actions",
        ["target_type", "target_id"],
    )
    op.create_index(
        "ix_moderation_actions_action_created",
        "moderation_actions",
        ["action", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("moderation_actions")
    bind = op.get_bind()
    for name in ("moderation_action_type", "moderation_target_type"):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
