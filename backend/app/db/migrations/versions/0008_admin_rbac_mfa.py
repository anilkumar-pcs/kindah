"""admin roles, MFA and append-only audit logs

Revision ID: 0008_admin_rbac_mfa
Revises: 0007_moderation_reports
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_admin_rbac_mfa"
down_revision: str | None = "0007_moderation_reports"
branch_labels: str | None = None
depends_on: str | None = None

_ROLES = ("USER", "MODERATOR", "ADMIN")


def upgrade() -> None:
    bind = op.get_bind()
    role_enum = postgresql.ENUM(*_ROLES, name="user_role", create_type=False)
    role_enum.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "role",
            role_enum,
            nullable=False,
            server_default=sa.text("'USER'"),
        ),
    )
    op.add_column("users", sa.Column("mfa_secret_encrypted", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("mfa_enabled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("mfa_last_used_step", sa.Integer(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "mfa_recovery_codes_hashed",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    op.create_table(
        "admin_audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=48), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason_encrypted", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name="fk_admin_audit_logs_actor",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_admin_audit_logs"),
    )
    op.create_index(
        "ix_admin_audit_logs_actor_created",
        "admin_audit_logs",
        ["actor_id", "created_at"],
    )
    op.create_index(
        "ix_admin_audit_logs_action_created",
        "admin_audit_logs",
        ["action", "created_at"],
    )
    op.create_index(
        "ix_admin_audit_logs_target",
        "admin_audit_logs",
        ["target_type", "target_id"],
    )

    op.execute(
        """
        CREATE FUNCTION prevent_admin_audit_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'admin_audit_logs is append-only';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_admin_audit_logs_append_only
        BEFORE UPDATE OR DELETE ON admin_audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_mutation();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_admin_audit_logs_append_only ON admin_audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_admin_audit_mutation()")
    op.drop_table("admin_audit_logs")
    op.drop_column("users", "mfa_recovery_codes_hashed")
    op.drop_column("users", "mfa_last_used_step")
    op.drop_column("users", "mfa_enabled_at")
    op.drop_column("users", "mfa_secret_encrypted")
    op.drop_column("users", "role")
    bind = op.get_bind()
    postgresql.ENUM(name="user_role").drop(bind, checkfirst=True)
