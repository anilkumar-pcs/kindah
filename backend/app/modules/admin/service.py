from __future__ import annotations

import hmac
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import (
    create_mfa_token,
    generate_recovery_codes,
    generate_totp_secret,
    hash_recovery_code,
    match_totp_step,
    normalize_recovery_code,
    totp_uri,
)
from app.modules.admin.audit import record_admin_audit
from app.modules.admin.models import AdminAuditLog
from app.modules.admin.rbac import effective_role
from app.modules.admin.schemas import (
    AdminAuditLogList,
    AdminAuditLogResponse,
    AdminMfaStatusResponse,
    MfaEnableResponse,
    MfaSetupResponse,
    MfaVerifyResponse,
)
from app.modules.identity.models import User
from app.providers.crypto.base import CryptoProvider


class AdminService:
    def __init__(
        self,
        *,
        settings: Settings,
        session: Session,
        crypto: CryptoProvider,
    ) -> None:
        self.settings = settings
        self.session = session
        self.crypto = crypto

    def mfa_status(self, user: User) -> AdminMfaStatusResponse:
        return AdminMfaStatusResponse(
            role=effective_role(self.settings, user),
            mfa_enabled=user.mfa_enabled_at is not None,
            mfa_required=True,
            recovery_codes_remaining=len(user.mfa_recovery_codes_hashed or []),
        )

    def setup_mfa(self, user: User) -> MfaSetupResponse:
        if user.mfa_enabled_at is not None:
            raise AppError(
                409,
                "MFA_ALREADY_ENABLED",
                "MFA already enabled",
                "Authenticator MFA is already active for this account.",
            )
        secret = generate_totp_secret()
        user.mfa_secret_encrypted = self.crypto.encrypt(
            secret,
            context="admin.mfa.secret",
        )
        user.mfa_last_used_step = None
        user.updated_at = datetime.now(UTC)
        self.session.commit()
        account_name = user.display_name or str(user.id)
        return MfaSetupResponse(
            secret=secret,
            otpauth_uri=totp_uri(self.settings, secret, account_name),
        )

    def enable_mfa(self, user: User, session_id: UUID, code: str) -> MfaEnableResponse:
        if user.mfa_enabled_at is not None:
            raise AppError(
                409,
                "MFA_ALREADY_ENABLED",
                "MFA already enabled",
                "Authenticator MFA is already active for this account.",
            )
        if not user.mfa_secret_encrypted:
            raise AppError(
                403,
                "MFA_SETUP_REQUIRED",
                "MFA setup required",
                "Start authenticator setup before enabling MFA.",
            )
        secret = self.crypto.decrypt(
            user.mfa_secret_encrypted,
            context="admin.mfa.secret",
        )
        step = match_totp_step(secret, code)
        if step is None:
            raise AppError(
                422,
                "MFA_INVALID_CODE",
                "Invalid authenticator code",
                "Enter the current six-digit code from your authenticator app.",
            )

        recovery_codes = generate_recovery_codes()
        user.mfa_recovery_codes_hashed = [
            hash_recovery_code(self.settings, value) for value in recovery_codes
        ]
        user.mfa_enabled_at = datetime.now(UTC)
        user.mfa_last_used_step = step
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=user.id,
            action="ADMIN_MFA_ENABLED",
            target_type="USER",
            target_id=user.id,
            metadata={"method": "TOTP"},
        )
        self.session.commit()
        token, expires_at = self._mfa_token(user, session_id)
        return MfaEnableResponse(
            mfa_enabled=True,
            mfa_token=token,
            expires_in=self._ttl_seconds(expires_at),
            recovery_codes=recovery_codes,
        )

    def verify_mfa(self, user: User, session_id: UUID, code: str) -> MfaVerifyResponse:
        if user.mfa_enabled_at is None or not user.mfa_secret_encrypted:
            raise AppError(
                403,
                "MFA_SETUP_REQUIRED",
                "MFA setup required",
                "Set up authenticator MFA before using the admin area.",
            )
        secret = self.crypto.decrypt(
            user.mfa_secret_encrypted,
            context="admin.mfa.secret",
        )
        step = match_totp_step(secret, code)
        if step is not None and (user.mfa_last_used_step is None or step > user.mfa_last_used_step):
            user.mfa_last_used_step = step
            user.updated_at = datetime.now(UTC)
            self.session.commit()
            token, expires_at = self._mfa_token(user, session_id)
            return MfaVerifyResponse(
                mfa_token=token,
                expires_in=self._ttl_seconds(expires_at),
                method="TOTP",
            )

        normalized = normalize_recovery_code(code)
        candidate = hash_recovery_code(self.settings, normalized)
        remaining = list(user.mfa_recovery_codes_hashed or [])
        matched = next(
            (hashed for hashed in remaining if hmac.compare_digest(hashed, candidate)),
            None,
        )
        if matched is None:
            raise AppError(
                401,
                "MFA_INVALID_CODE",
                "Invalid MFA code",
                "The authenticator or recovery code is invalid.",
            )
        remaining.remove(matched)
        user.mfa_recovery_codes_hashed = remaining
        user.updated_at = datetime.now(UTC)
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=user.id,
            action="ADMIN_MFA_RECOVERY_USED",
            target_type="USER",
            target_id=user.id,
        )
        self.session.commit()
        token, expires_at = self._mfa_token(user, session_id)
        return MfaVerifyResponse(
            mfa_token=token,
            expires_in=self._ttl_seconds(expires_at),
            method="RECOVERY",
        )

    def audit_logs(self) -> AdminAuditLogList:
        entries = list(
            self.session.scalars(
                select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(100)
            )
        )
        actor_ids = {entry.actor_id for entry in entries}
        actors = {
            user.id: user
            for user in self.session.scalars(select(User).where(User.id.in_(actor_ids)))
        }
        return AdminAuditLogList(
            logs=[
                AdminAuditLogResponse(
                    id=entry.id,
                    actor_display_name=(
                        actors[entry.actor_id].display_name if entry.actor_id in actors else None
                    ),
                    action=entry.action,
                    target_type=entry.target_type,
                    target_id=entry.target_id,
                    reason=(
                        self.crypto.decrypt(
                            entry.reason_encrypted,
                            context="admin.audit.reason",
                        )
                        if entry.reason_encrypted
                        else None
                    ),
                    request_id=entry.request_id,
                    metadata=entry.event_metadata,
                    created_at=entry.created_at,
                )
                for entry in entries
            ]
        )

    def _mfa_token(self, user: User, session_id: UUID) -> tuple[str, datetime]:
        return create_mfa_token(
            self.settings,
            user_id=str(user.id),
            session_id=str(session_id),
        )

    def _ttl_seconds(self, expires_at: datetime) -> int:
        return max(0, int((expires_at - datetime.now(UTC)).total_seconds()))
