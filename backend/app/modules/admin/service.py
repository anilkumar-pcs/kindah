from __future__ import annotations

import hmac
import uuid
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
from app.modules.admin.models import (
    AdminAuditLog,
    ModerationAction,
    ModerationActionType,
    ModerationTargetType,
)
from app.modules.admin.rbac import effective_role
from app.modules.admin.schemas import (
    AdminAuditLogList,
    AdminAuditLogResponse,
    AdminMfaStatusResponse,
    MfaEnableResponse,
    MfaSetupResponse,
    MfaVerifyResponse,
    ModerationActionResponse,
    UserModerationActionRequest,
    WishModerationActionRequest,
)
from app.modules.gifts.models import Gift, GiftStatus
from app.modules.identity.models import User, UserRole, UserStatus
from app.modules.wishes.models import Wish, WishStatus
from app.providers.crypto.base import CryptoProvider

_UNRESOLVED_GIFT_STATUSES = (
    GiftStatus.CREATED,
    GiftStatus.HANDOFF_ISSUED,
    GiftStatus.DONOR_PENDING,
    GiftStatus.DONOR_CLAIMED_PAID,
)


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

    def moderate_user(
        self,
        admin: User,
        target_id: UUID,
        request: UserModerationActionRequest,
    ) -> ModerationActionResponse:
        target = self.session.get(User, target_id)
        if target is None:
            raise AppError(404, "NOT_FOUND", "User not found", "This user is unavailable.")
        if target.id == admin.id:
            raise AppError(
                422,
                "CANNOT_MODERATE_SELF",
                "Cannot moderate yourself",
                "Use another administrator account for this action.",
            )
        actor_role = effective_role(self.settings, admin)
        if target.role == UserRole.ADMIN and actor_role != UserRole.ADMIN:
            raise AppError(
                403,
                "FORBIDDEN",
                "Moderator cannot act on an administrator",
                "Only an administrator can moderate another administrator.",
            )
        if target.role == UserRole.MODERATOR and actor_role != UserRole.ADMIN:
            raise AppError(
                403,
                "FORBIDDEN",
                "Moderator cannot act on a moderator",
                "Only an administrator can moderate another moderator.",
            )
        if target.status == UserStatus.DELETED:
            raise self._invalid_action("Deleted accounts cannot be moderated.")

        now = datetime.now(UTC)
        if request.action == "WARN":
            target.trust_strikes += 1
        elif request.action == "RESTRICT":
            if target.status != UserStatus.ACTIVE:
                raise self._invalid_action("Only an active account can be restricted.")
            target.status = UserStatus.RESTRICTED
        elif request.action == "SUSPEND":
            if target.status not in {UserStatus.ACTIVE, UserStatus.RESTRICTED}:
                raise self._invalid_action("Only an active or restricted account can be suspended.")
            target.status = UserStatus.SUSPENDED
        elif request.action == "BAN":
            if target.status == UserStatus.BANNED:
                raise self._invalid_action("This account is already banned.")
            target.status = UserStatus.BANNED
        else:
            if target.status == UserStatus.ACTIVE:
                raise self._invalid_action("This account is already active.")
            target.status = UserStatus.ACTIVE
        target.updated_at = now

        record = self._record_action(
            admin=admin,
            target_type=ModerationTargetType.USER,
            target_id=target.id,
            action=request.action,
            reason=request.reason,
            audit_action={
                "WARN": "USER_WARNED",
                "RESTRICT": "USER_RESTRICTED",
                "SUSPEND": "USER_SUSPENDED",
                "BAN": "USER_BANNED",
                "REACTIVATE": "USER_REACTIVATED",
            }[request.action],
            now=now,
        )
        self.session.commit()
        return self._action_response(record, admin)

    def moderate_wish(
        self,
        admin: User,
        wish_id: UUID,
        request: WishModerationActionRequest,
    ) -> ModerationActionResponse:
        wish = self.session.scalar(select(Wish).where(Wish.id == wish_id).with_for_update())
        if wish is None:
            raise AppError(404, "NOT_FOUND", "Wish not found", "This wish is unavailable.")
        now = datetime.now(UTC)
        if request.action == "HIDE":
            if wish.status != WishStatus.OPEN or wish.expires_at <= now:
                raise self._invalid_action("Only an active OPEN wish can be hidden.")
            wish.status = WishStatus.UNDER_REVIEW
        elif request.action == "RESTORE":
            if wish.status != WishStatus.UNDER_REVIEW:
                raise self._invalid_action("Only an UNDER_REVIEW wish can be restored.")
            if wish.expires_at <= now:
                raise self._invalid_action("An expired wish cannot be restored.")
            if self._has_unresolved_gift(wish.id):
                raise self._invalid_action("A wish with an unresolved gift cannot be restored.")
            wish.status = WishStatus.OPEN
            wish.closed_reason = None
        else:
            if wish.status not in {WishStatus.OPEN, WishStatus.UNDER_REVIEW}:
                raise self._invalid_action("Only an OPEN or UNDER_REVIEW wish can be removed.")
            if self._has_unresolved_gift(wish.id):
                raise self._invalid_action("A wish with an unresolved gift cannot be removed.")
            wish.status = WishStatus.REMOVED
            wish.closed_reason = "REMOVED_BY_MODERATION"
        wish.updated_at = now

        record = self._record_action(
            admin=admin,
            target_type=ModerationTargetType.WISH,
            target_id=wish.id,
            action=request.action,
            reason=request.reason,
            audit_action={
                "HIDE": "WISH_HIDDEN",
                "RESTORE": "WISH_RESTORED",
                "REMOVE": "WISH_REMOVED",
            }[request.action],
            now=now,
        )
        self.session.commit()
        return self._action_response(record, admin)

    def _has_unresolved_gift(self, wish_id: UUID) -> bool:
        return (
            self.session.scalar(
                select(Gift.id)
                .where(
                    Gift.wish_id == wish_id,
                    Gift.status.in_(list(_UNRESOLVED_GIFT_STATUSES)),
                )
                .limit(1)
            )
            is not None
        )

    def _record_action(
        self,
        *,
        admin: User,
        target_type: ModerationTargetType,
        target_id: UUID,
        action: str,
        reason: str,
        audit_action: str,
        now: datetime,
    ) -> ModerationAction:
        record = ModerationAction(
            id=uuid.uuid4(),
            moderator_id=admin.id,
            target_type=target_type,
            target_id=target_id,
            action=ModerationActionType(action),
            reason_encrypted=self.crypto.encrypt(reason, context="moderation.reason"),
            created_at=now,
        )
        self.session.add(record)
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=admin.id,
            action=audit_action,
            target_type=target_type.value,
            target_id=target_id,
            reason=reason,
            metadata={"moderationActionId": str(record.id)},
        )
        return record

    def _action_response(
        self,
        record: ModerationAction,
        admin: User,
    ) -> ModerationActionResponse:
        return ModerationActionResponse(
            id=record.id,
            target_type=record.target_type.value,
            target_id=record.target_id,
            action=record.action.value,
            reason=self.crypto.decrypt(
                record.reason_encrypted,
                context="moderation.reason",
            ),
            moderator_display_name=admin.display_name,
            created_at=record.created_at,
        )

    def _invalid_action(self, detail: str) -> AppError:
        return AppError(
            422,
            "INVALID_STATE_TRANSITION",
            "Action not allowed",
            detail,
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
