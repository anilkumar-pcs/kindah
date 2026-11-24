from __future__ import annotations

import hmac
import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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
    AppealStatus,
    ModerationAction,
    ModerationActionType,
    ModerationAppeal,
    ModerationTargetType,
)
from app.modules.admin.rbac import effective_role
from app.modules.admin.schemas import (
    AdminAppealList,
    AdminAppealResponse,
    AdminAuditLogList,
    AdminAuditLogResponse,
    AdminMfaStatusResponse,
    AppealCreateRequest,
    AppealList,
    AppealResolveRequest,
    AppealResponse,
    MfaEnableResponse,
    MfaSetupResponse,
    MfaVerifyResponse,
    ModerationActionList,
    ModerationActionResponse,
    ModerationActionSummaryResponse,
    UserModerationActionRequest,
    WishModerationActionRequest,
)
from app.modules.gifts.models import Gift, GiftStatus
from app.modules.identity.audit import record_audit_event
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

    # ------------------------------------------------------------------
    # Appeals
    # ------------------------------------------------------------------
    def list_my_actions(self, user: User) -> ModerationActionList:
        actions = list(
            self.session.scalars(
                select(ModerationAction)
                .where(
                    ModerationAction.target_type == ModerationTargetType.USER,
                    ModerationAction.target_id == user.id,
                )
                .order_by(ModerationAction.created_at.desc())
            )
        )
        appeals = {
            appeal.action_id: appeal
            for appeal in self.session.scalars(
                select(ModerationAppeal).where(ModerationAppeal.user_id == user.id)
            )
        }
        return ModerationActionList(
            actions=[
                ModerationActionSummaryResponse(
                    id=action.id,
                    action=action.action.value,
                    reason=self.crypto.decrypt(
                        action.reason_encrypted,
                        context="moderation.reason",
                    ),
                    appeal_status=(appeals[action.id].status if action.id in appeals else None),
                    can_appeal=(
                        action.action
                        in {
                            ModerationActionType.RESTRICT,
                            ModerationActionType.SUSPEND,
                            ModerationActionType.BAN,
                        }
                        and action.id not in appeals
                    ),
                    created_at=action.created_at,
                )
                for action in actions
            ]
        )

    def create_appeal(
        self,
        user: User,
        action_id: UUID,
        request: AppealCreateRequest,
    ) -> AppealResponse:
        action = self.session.scalar(
            select(ModerationAction).where(ModerationAction.id == action_id).with_for_update()
        )
        if (
            action is None
            or action.target_type != ModerationTargetType.USER
            or action.target_id != user.id
        ):
            raise AppError(404, "NOT_FOUND", "Action not found", "This action is unavailable.")
        if action.action not in {
            ModerationActionType.RESTRICT,
            ModerationActionType.SUSPEND,
            ModerationActionType.BAN,
        }:
            raise AppError(
                422,
                "NOT_APPEALABLE",
                "Action cannot be appealed",
                "Warnings and reactivations are not appealable.",
            )
        existing = self.session.scalar(
            select(ModerationAppeal.id).where(ModerationAppeal.action_id == action_id)
        )
        if existing is not None:
            raise AppError(
                409,
                "APPEAL_EXISTS",
                "Appeal already submitted",
                "You have already appealed this action.",
            )
        now = datetime.now(UTC)
        appeal = ModerationAppeal(
            id=uuid.uuid4(),
            action_id=action.id,
            user_id=user.id,
            status=AppealStatus.OPEN,
            reason_encrypted=self.crypto.encrypt(
                request.reason,
                context="appeal.reason",
            ),
            created_at=now,
            updated_at=now,
        )
        self.session.add(appeal)
        record_audit_event(
            session=self.session,
            event_type="APPEAL_SUBMITTED",
            user_id=user.id,
            metadata={"appealId": str(appeal.id), "actionId": str(action.id)},
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise AppError(
                409,
                "APPEAL_EXISTS",
                "Appeal already submitted",
                "You have already appealed this action.",
            ) from exc
        return self._appeal_response(appeal)

    def list_my_appeals(self, user: User) -> AppealList:
        appeals = list(
            self.session.scalars(
                select(ModerationAppeal)
                .where(ModerationAppeal.user_id == user.id)
                .order_by(ModerationAppeal.created_at.desc())
            )
        )
        return AppealList(appeals=[self._appeal_response(appeal) for appeal in appeals])

    def list_admin_appeals(self, status: AppealStatus | None = None) -> AdminAppealList:
        statement = select(ModerationAppeal).order_by(ModerationAppeal.created_at.asc()).limit(100)
        if status is not None:
            statement = statement.where(ModerationAppeal.status == status)
        appeals = list(self.session.scalars(statement))
        return AdminAppealList(appeals=[self._admin_appeal_response(appeal) for appeal in appeals])

    def resolve_appeal(
        self,
        admin: User,
        appeal_id: UUID,
        request: AppealResolveRequest,
    ) -> AdminAppealResponse:
        appeal = self.session.scalar(
            select(ModerationAppeal).where(ModerationAppeal.id == appeal_id).with_for_update()
        )
        if appeal is None:
            raise AppError(404, "NOT_FOUND", "Appeal not found", "This appeal is unavailable.")
        if appeal.status not in {AppealStatus.OPEN, AppealStatus.UNDER_REVIEW}:
            raise self._invalid_action("This appeal has already been resolved.")
        now = datetime.now(UTC)
        appeal.status = AppealStatus(request.outcome)
        appeal.resolution_encrypted = self.crypto.encrypt(
            request.resolution_note,
            context="appeal.resolution",
        )
        appeal.resolved_by = admin.id
        appeal.resolved_at = now
        appeal.updated_at = now
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=admin.id,
            action=f"APPEAL_{request.outcome}",
            target_type="APPEAL",
            target_id=appeal.id,
            reason=request.resolution_note,
            metadata={
                "actionId": str(appeal.action_id),
                "userId": str(appeal.user_id),
            },
        )
        self.session.commit()
        return self._admin_appeal_response(appeal, resolver=admin)

    def _appeal_response(self, appeal: ModerationAppeal) -> AppealResponse:
        return AppealResponse(
            id=appeal.id,
            action_id=appeal.action_id,
            status=appeal.status,
            reason=self.crypto.decrypt(appeal.reason_encrypted, context="appeal.reason"),
            resolution_note=(
                self.crypto.decrypt(
                    appeal.resolution_encrypted,
                    context="appeal.resolution",
                )
                if appeal.resolution_encrypted
                else None
            ),
            created_at=appeal.created_at,
            updated_at=appeal.updated_at,
            resolved_at=appeal.resolved_at,
        )

    def _admin_appeal_response(
        self,
        appeal: ModerationAppeal,
        *,
        resolver: User | None = None,
    ) -> AdminAppealResponse:
        action = self.session.get(ModerationAction, appeal.action_id)
        user = self.session.get(User, appeal.user_id)
        if resolver is None and appeal.resolved_by:
            resolver = self.session.get(User, appeal.resolved_by)
        return AdminAppealResponse(
            id=appeal.id,
            action_id=appeal.action_id,
            user_display_name=user.display_name if user else None,
            action=action.action.value if action else "UNKNOWN",
            action_reason=(
                self.crypto.decrypt(
                    action.reason_encrypted,
                    context="moderation.reason",
                )
                if action
                else ""
            ),
            target_type=action.target_type.value if action else "USER",
            target_id=action.target_id if action else appeal.user_id,
            status=appeal.status,
            reason=self.crypto.decrypt(appeal.reason_encrypted, context="appeal.reason"),
            resolution_note=(
                self.crypto.decrypt(
                    appeal.resolution_encrypted,
                    context="appeal.resolution",
                )
                if appeal.resolution_encrypted
                else None
            ),
            resolved_by_display_name=resolver.display_name if resolver else None,
            created_at=appeal.created_at,
            resolved_at=appeal.resolved_at,
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
