"""account deletion requests

Revision ID: 0011_account_deletion_requests
Revises: 0010_moderation_appeals
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_account_deletion_requests"
down_revision: str | None = "0010_moderation_appeals"
branch_labels: str | None = None
depends_on: str | None = None

_STATUSES = ("REQUESTED", "CANCELLED", "COMPLETED")


def upgrade() -> None:
    bind = op.get_bind()
    status = postgresql.ENUM(*_STATUSES, name="deletion_request_status", create_type=False)
    status.create(bind, checkfirst=True)

    op.create_table(
        "account_deletion_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", status, server_default=sa.text("'REQUESTED'"), nullable=False),
        sa.Column("reason_encrypted", sa.Text(), nullable=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_account_deletion_requests_user",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_account_deletion_requests"),
        sa.UniqueConstraint("user_id", name="uq_account_deletion_requests_user"),
    )
    op.create_index(
        "ix_account_deletion_requests_status_created",
        "account_deletion_requests",
        ["status", "requested_at"],
    )


def downgrade() -> None:
    op.drop_table("account_deletion_requests")
    bind = op.get_bind()
    postgresql.ENUM(name="deletion_request_status").drop(bind, checkfirst=True)
