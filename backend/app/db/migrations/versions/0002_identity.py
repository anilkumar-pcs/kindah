"""identity: users, sessions, otp challenges and auth events

Revision ID: 0002_identity
Revises: 0001_baseline
Create Date: 2026-11-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_identity"
down_revision: str | None = "0001_baseline"
branch_labels: str | None = None
depends_on: str | None = None

_USER_STATUS_VALUES = (
    "ACTIVE",
    "RESTRICTED",
    "SUSPENDED",
    "BANNED",
    "DELETION_PENDING",
    "DELETED",
)


def upgrade() -> None:
    bind = op.get_bind()
    user_status = postgresql.ENUM(
        *_USER_STATUS_VALUES,
        name="user_status",
        create_type=False,
    )
    user_status.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("mobile_encrypted", sa.Text(), nullable=False),
        sa.Column("mobile_hmac", sa.String(length=64), nullable=False),
        sa.Column("mobile_masked", sa.String(length=24), nullable=False),
        sa.Column("status", user_status, server_default=sa.text("'ACTIVE'"), nullable=False),
        sa.Column("display_name", sa.String(length=24), nullable=True),
        sa.Column("display_name_normalized", sa.String(length=24), nullable=True),
        sa.Column("avatar", sa.String(length=24), nullable=True),
        sa.Column("city", sa.String(length=60), nullable=True),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("age_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terms_version", sa.String(length=32), nullable=True),
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("privacy_version", sa.String(length=32), nullable=True),
        sa.Column("privacy_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("guidelines_version", sa.String(length=32), nullable=True),
        sa.Column("guidelines_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trust_strikes", sa.Integer(), server_default="0", nullable=False),
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
        sa.CheckConstraint(
            "display_name IS NULL OR char_length(display_name) BETWEEN 3 AND 24",
            name="ck_users_display_name_length",
        ),
        sa.CheckConstraint(
            "display_name IS NULL OR display_name_normalized IS NOT NULL",
            name="ck_users_display_name_normalized",
        ),
        sa.CheckConstraint("trust_strikes >= 0", name="ck_users_trust_strikes"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("mobile_hmac", name="uq_users_mobile_hmac"),
        sa.UniqueConstraint(
            "display_name_normalized",
            name="uq_users_display_name_normalized",
        ),
    )
    op.create_index("ix_users_status", "users", ["status"])

    op.create_table(
        "user_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "replaced_by_session_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("request_ip_hmac", sa.String(length=64), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=64), nullable=True),
        sa.CheckConstraint("expires_at > created_at", name="ck_user_sessions_expiry"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_sessions_user",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["replaced_by_session_id"],
            ["user_sessions.id"],
            name="fk_user_sessions_replaced_by",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_sessions"),
        sa.UniqueConstraint(
            "refresh_token_hash",
            name="uq_user_sessions_refresh_token_hash",
        ),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_family_id", "user_sessions", ["family_id"])

    op.create_table(
        "otp_challenges",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("mobile_encrypted", sa.Text(), nullable=False),
        sa.Column("mobile_hmac", sa.String(length=64), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("request_ip_hmac", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("attempts >= 0", name="ck_otp_challenges_attempts"),
        sa.CheckConstraint("expires_at > created_at", name="ck_otp_challenges_expiry"),
        sa.PrimaryKeyConstraint("id", name="pk_otp_challenges"),
    )
    op.create_index(
        "ix_otp_challenges_mobile_created",
        "otp_challenges",
        ["mobile_hmac", "created_at"],
    )
    op.create_index(
        "ix_otp_challenges_ip_created",
        "otp_challenges",
        ["request_ip_hmac", "created_at"],
    )
    op.create_index("ix_otp_challenges_expires_at", "otp_challenges", ["expires_at"])

    op.create_table(
        "auth_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column("request_ip_hmac", sa.String(length=64), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_auth_events_user",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_auth_events"),
    )
    op.create_index(
        "ix_auth_events_user_created",
        "auth_events",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_auth_events_type_created",
        "auth_events",
        ["event_type", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("auth_events")
    op.drop_table("otp_challenges")
    op.drop_table("user_sessions")
    op.drop_table("users")
    postgresql.ENUM(name="user_status").drop(op.get_bind(), checkfirst=True)
