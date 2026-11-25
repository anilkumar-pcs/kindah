from __future__ import annotations

import hmac
import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

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
    AccountDeletionRequest,
    AdminAuditLog,
    AppealStatus,
    DeletionRequestStatus,
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
    AdminDeletionRequestList,
    AdminDeletionRequestResponse,
    AdminMfaStatusResponse,
    AdminUserList,
    AdminUserSummary,
    AdminWishList,
    AdminWishSummary,
    AppealCreateRequest,
    AppealList,
    AppealResolveRequest,
    AppealResponse,
    BadgeDefinitionCreate,
    BadgeDefinitionList,
    BadgeDefinitionResponse,
    BadgeDefinitionUpdate,
    DeletionRequestCreate,
    DeletionRequestResponse,
    MfaEnableResponse,
    MfaSetupResponse,
    MfaVerifyResponse,
    ModerationActionList,
    ModerationActionResponse,
    ModerationActionSummaryResponse,
    OutboxDeadLetterList,
    OutboxDeadLetterResponse,
    UserModerationActionRequest,
    UserRoleUpdateRequest,
    WishModerationActionRequest,
)
from app.modules.gifts.models import Gift, GiftStatus, OutboxEvent
from app.modules.identity.audit import record_audit_event
from app.modules.identity.models import User, UserRole, UserStatus
from app.modules.karma.badges import BadgeDefinition
from app.modules.notifications.service import notify
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
            role=effective_role(user),
            mfa_enabled=user.mfa_enabled_at is not None,
            mfa_required=self.settings.admin_mfa_required,
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

    def list_users(
        self,
        query: str | None = None,
        status: UserStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AdminUserList:
        conditions = [User.status != UserStatus.DELETED]
        if status is not None and status != UserStatus.DELETED:
            conditions.append(User.status == status)
        if query and query.strip():
            conditions.append(func.lower(User.display_name).contains(query.strip().lower()))
        total = int(self.session.scalar(select(func.count(User.id)).where(*conditions)) or 0)
        statement = (
            select(User)
            .where(*conditions)
            .order_by(User.created_at.desc(), User.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return AdminUserList(
            users=[self._user_summary(user) for user in self.session.scalars(statement)],
            total=total,
            page=page,
            page_size=page_size,
        )

    def list_admin_wishes(
        self,
        query: str | None = None,
        status: WishStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AdminWishList:
        conditions = []
        if query and query.strip():
            term = query.strip().lower()
            conditions.append(
                or_(
                    func.lower(Wish.message).contains(term),
                    func.lower(User.display_name).contains(term),
                )
            )
        if status is not None:
            conditions.append(Wish.status == status)

        total = int(
            self.session.scalar(
                select(func.count(Wish.id))
                .select_from(Wish)
                .join(User, Wish.user_id == User.id)
                .where(*conditions)
            )
            or 0
        )
        rows = self.session.execute(
            select(Wish, User)
            .join(User, Wish.user_id == User.id)
            .where(*conditions)
            .order_by(Wish.created_at.desc(), Wish.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        wishes = [
            AdminWishSummary(
                id=wish.id,
                display_name=user.display_name,
                message=wish.message,
                mood=wish.mood,
                suggested_amount_inr=wish.suggested_amount_inr,
                city=wish.city,
                status=wish.status,
                closed_reason=wish.closed_reason,
                created_at=wish.created_at,
                expires_at=wish.expires_at,
            )
            for wish, user in rows
        ]
        return AdminWishList(
            wishes=wishes,
            total=total,
            page=page,
            page_size=page_size,
        )

    def set_user_role(
        self,
        admin: User,
        target_id: UUID,
        request: UserRoleUpdateRequest,
    ) -> AdminUserSummary:
        if effective_role(admin) != UserRole.ADMIN:
            raise AppError(
                403,
                "FORBIDDEN",
                "Administrator access required",
                "Only an administrator can change roles.",
            )
        target = self.session.get(User, target_id)
        if target is None or target.status == UserStatus.DELETED:
            raise AppError(404, "NOT_FOUND", "User not found", "This user is unavailable.")
        if target.id == admin.id:
            raise AppError(
                422,
                "CANNOT_CHANGE_OWN_ROLE",
                "Cannot change your own role",
                "Ask another administrator to change your role.",
            )
        if target.role == request.role:
            raise self._invalid_action(f"This user already has role {request.role.value}.")
        from_role = target.role
        now = datetime.now(UTC)
        target.role = request.role
        target.updated_at = now
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=admin.id,
            action="USER_ROLE_CHANGED",
            target_type="USER",
            target_id=target.id,
            reason=request.reason,
            metadata={"fromRole": from_role.value, "toRole": request.role.value},
        )
        notify(
            session=self.session,
            user_id=target.id,
            dedupe_key=f"role-change:{target.id}:{uuid.uuid4()}",
            notification_type="ACCOUNT_ROLE_CHANGED",
            title="Account role updated",
            body=f"Your account role is now {request.role.value}.",
            entity_type="USER",
            entity_id=target.id,
            payload={"role": request.role.value},
        )
        self.session.commit()
        return self._user_summary(target)

    def _user_summary(self, user: User) -> AdminUserSummary:
        return AdminUserSummary(
            id=user.id,
            display_name=user.display_name,
            role=user.role,
            status=user.status,
            created_at=user.created_at,
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
        actor_role = effective_role(admin)
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
        if target_type == ModerationTargetType.USER:
            notify(
                session=self.session,
                user_id=target_id,
                dedupe_key=f"moderation:{record.id}",
                notification_type="ACCOUNT_MODERATION",
                title={
                    "WARN": "Account warning",
                    "RESTRICT": "Account restricted",
                    "SUSPEND": "Account suspended",
                    "BAN": "Account banned",
                    "REACTIVATE": "Account reactivated",
                }[action],
                body="Open Appeals to review the action and submit an appeal where available.",
                entity_type="USER",
                entity_id=target_id,
                payload={"action": action},
            )
        else:
            wish = self.session.get(Wish, target_id)
            if wish is not None:
                notify(
                    session=self.session,
                    user_id=wish.user_id,
                    dedupe_key=f"moderation:{record.id}",
                    notification_type="WISH_MODERATION",
                    title={
                        "HIDE": "Wish hidden for review",
                        "RESTORE": "Wish restored",
                        "REMOVE": "Wish removed",
                    }[action],
                    body="Open the wish for current status, or Appeals for account actions.",
                    entity_type="WISH",
                    entity_id=wish.id,
                    payload={"wishId": str(wish.id), "action": action},
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
    # Badge definitions
    # ------------------------------------------------------------------
    def list_badge_definitions(self) -> BadgeDefinitionList:
        definitions = list(
            self.session.scalars(
                select(BadgeDefinition).order_by(
                    BadgeDefinition.sort_order,
                    BadgeDefinition.code,
                )
            )
        )
        return BadgeDefinitionList(
            badges=[self._badge_definition_response(item) for item in definitions]
        )

    def create_badge_definition(
        self,
        admin: User,
        request: BadgeDefinitionCreate,
    ) -> BadgeDefinitionResponse:
        existing = self.session.get(BadgeDefinition, request.code)
        if existing is not None:
            raise AppError(
                409,
                "BADGE_EXISTS",
                "Badge already exists",
                "A badge definition with this code already exists.",
            )
        now = datetime.now(UTC)
        definition = BadgeDefinition(
            code=request.code,
            label=request.label,
            rule_type=request.rule_type,
            threshold=request.threshold,
            active=request.active,
            sort_order=request.sort_order,
            created_at=now,
            updated_at=now,
        )
        self.session.add(definition)
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=admin.id,
            action="BADGE_DEFINITION_CREATED",
            target_type="BADGE",
            target_id=None,
            metadata={"code": request.code},
        )
        self.session.commit()
        return self._badge_definition_response(definition)

    def update_badge_definition(
        self,
        admin: User,
        code: str,
        request: BadgeDefinitionUpdate,
    ) -> BadgeDefinitionResponse:
        definition = self.session.get(BadgeDefinition, code)
        if definition is None:
            raise AppError(404, "NOT_FOUND", "Badge not found", "This badge is unavailable.")
        changed: list[str] = []
        for field in ("label", "rule_type", "threshold", "active", "sort_order"):
            value = getattr(request, field)
            if field in request.model_fields_set and value is not None:
                setattr(definition, field, value)
                changed.append(field)
        definition.updated_at = datetime.now(UTC)
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=admin.id,
            action="BADGE_DEFINITION_UPDATED",
            target_type="BADGE",
            target_id=None,
            metadata={"code": code, "fields": changed},
        )
        self.session.commit()
        return self._badge_definition_response(definition)

    def deactivate_badge_definition(
        self,
        admin: User,
        code: str,
    ) -> BadgeDefinitionResponse:
        definition = self.session.get(BadgeDefinition, code)
        if definition is None:
            raise AppError(404, "NOT_FOUND", "Badge not found", "This badge is unavailable.")
        definition.active = False
        definition.updated_at = datetime.now(UTC)
        record_admin_audit(
            session=self.session,
            crypto=self.crypto,
            actor_id=admin.id,
            action="BADGE_DEFINITION_DEACTIVATED",
            target_type="BADGE",
            target_id=None,
            metadata={"code": code},
        )
        self.session.commit()
        return self._badge_definition_response(definition)

    def _badge_definition_response(
        self,
        definition: BadgeDefinition,
    ) -> BadgeDefinitionResponse:
        return BadgeDefinitionResponse(
            code=definition.code,
            label=definition.label,
            rule_type=definition.rule_type,
            threshold=definition.threshold,
            active=definition.active,
            sort_order=definition.sort_order,
            created_at=definition.created_at,
            updated_at=definition.updated_at,
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

    def list_admin_appeals(
        self,
        status: AppealStatus | None = None,
        query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AdminAppealList:
        conditions = []
        if status is not None:
            conditions.append(ModerationAppeal.status == status)
        if query and query.strip():
            conditions.append(func.lower(User.display_name).contains(query.strip().lower()))
        total = int(
            self.session.scalar(
                select(func.count(ModerationAppeal.id))
                .select_from(ModerationAppeal)
                .join(User, ModerationAppeal.user_id == User.id)
                .where(*conditions)
            )
            or 0
        )
        statement = (
            select(ModerationAppeal)
            .join(User, ModerationAppeal.user_id == User.id)
            .where(*conditions)
            .order_by(ModerationAppeal.created_at.desc(), ModerationAppeal.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        appeals = list(self.session.scalars(statement))
        return AdminAppealList(
            appeals=[self._admin_appeal_response(appeal) for appeal in appeals],
            total=total,
            page=page,
            page_size=page_size,
        )

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
        notify(
            session=self.session,
            user_id=appeal.user_id,
            dedupe_key=f"appeal:{appeal.id}:{request.outcome}",
            notification_type="APPEAL_RESOLVED",
            title=f"Appeal {request.outcome.lower()}",
            body="Open Appeals to review the resolution note.",
            entity_type="APPEAL",
            entity_id=appeal.id,
            payload={"appealId": str(appeal.id), "actionId": str(appeal.action_id)},
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

    # ------------------------------------------------------------------
    # Account deletion requests (non-destructive)
    # ------------------------------------------------------------------
    def get_deletion_request(self, user: User) -> DeletionRequestResponse:
        request = self.session.scalar(
            select(AccountDeletionRequest).where(AccountDeletionRequest.user_id == user.id)
        )
        if request is None:
            raise AppError(
                404,
                "DELETION_REQUEST_NOT_FOUND",
                "No deletion request",
                "No account deletion request is on file.",
            )
        return self._deletion_response(request)

    def request_deletion(
        self,
        user: User,
        request: DeletionRequestCreate,
    ) -> DeletionRequestResponse:
        if self._has_active_transactions(user.id):
            raise AppError(
                409,
                "ACTIVE_TRANSACTIONS",
                "Active wishes or gifts",
                "Finish or withdraw active wishes and gifts before requesting deletion.",
            )
        now = datetime.now(UTC)
        row = self.session.scalar(
            select(AccountDeletionRequest)
            .where(AccountDeletionRequest.user_id == user.id)
            .with_for_update()
        )
        if row is not None and row.status == DeletionRequestStatus.COMPLETED:
            raise AppError(
                409,
                "DELETION_ALREADY_COMPLETED",
                "Deletion already completed",
                "This account deletion request is already complete.",
            )
        if row is not None and row.status == DeletionRequestStatus.REQUESTED:
            if user.status != UserStatus.DELETION_PENDING:
                user.status = UserStatus.DELETION_PENDING
                user.updated_at = now
                self.session.commit()
            return self._deletion_response(row)
        if row is None:
            row = AccountDeletionRequest(
                id=uuid.uuid4(),
                user_id=user.id,
                status=DeletionRequestStatus.REQUESTED,
                reason_encrypted=(
                    self.crypto.encrypt(request.reason, context="deletion.reason")
                    if request.reason
                    else None
                ),
                requested_at=now,
                updated_at=now,
            )
            self.session.add(row)
        else:
            row.status = DeletionRequestStatus.REQUESTED
            row.reason_encrypted = (
                self.crypto.encrypt(request.reason, context="deletion.reason")
                if request.reason
                else row.reason_encrypted
            )
            row.requested_at = now
            row.cancelled_at = None
            row.updated_at = now
        user.status = UserStatus.DELETION_PENDING
        user.updated_at = now
        record_audit_event(
            session=self.session,
            event_type="DELETION_REQUESTED",
            user_id=user.id,
            metadata={"deletionRequestId": str(row.id)},
        )
        self.session.commit()
        return self._deletion_response(row)

    def cancel_deletion(self, user: User) -> DeletionRequestResponse:
        row = self.session.scalar(
            select(AccountDeletionRequest)
            .where(AccountDeletionRequest.user_id == user.id)
            .with_for_update()
        )
        if row is None or row.status != DeletionRequestStatus.REQUESTED:
            raise AppError(
                404,
                "DELETION_REQUEST_NOT_FOUND",
                "No active deletion request",
                "There is no active account deletion request to cancel.",
            )
        now = datetime.now(UTC)
        row.status = DeletionRequestStatus.CANCELLED
        row.cancelled_at = now
        row.updated_at = now
        user.status = UserStatus.ACTIVE
        user.updated_at = now
        record_audit_event(
            session=self.session,
            event_type="DELETION_CANCELLED",
            user_id=user.id,
            metadata={"deletionRequestId": str(row.id)},
        )
        self.session.commit()
        return self._deletion_response(row)

    def list_admin_deletion_requests(
        self,
        status: DeletionRequestStatus | None = None,
        query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AdminDeletionRequestList:
        conditions = []
        if status is not None:
            conditions.append(AccountDeletionRequest.status == status)
        if query and query.strip():
            conditions.append(func.lower(User.display_name).contains(query.strip().lower()))
        total = int(
            self.session.scalar(
                select(func.count(AccountDeletionRequest.id))
                .select_from(AccountDeletionRequest)
                .join(User, AccountDeletionRequest.user_id == User.id)
                .where(*conditions)
            )
            or 0
        )
        rows = self.session.execute(
            select(AccountDeletionRequest, User)
            .join(User, AccountDeletionRequest.user_id == User.id)
            .where(*conditions)
            .order_by(
                AccountDeletionRequest.requested_at.desc(),
                AccountDeletionRequest.id.desc(),
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        return AdminDeletionRequestList(
            requests=[
                AdminDeletionRequestResponse(
                    id=row.id,
                    user_display_name=user.display_name,
                    user_status=user.status,
                    status=row.status,
                    reason=(
                        self.crypto.decrypt(
                            row.reason_encrypted,
                            context="deletion.reason",
                        )
                        if row.reason_encrypted
                        else None
                    ),
                    requested_at=row.requested_at,
                    cancelled_at=row.cancelled_at,
                )
                for row, user in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    def _has_active_transactions(self, user_id: UUID) -> bool:
        active_wish = self.session.scalar(
            select(Wish.id)
            .where(
                Wish.user_id == user_id,
                Wish.status.in_([WishStatus.OPEN, WishStatus.LOCKED, WishStatus.PAYMENT_CLAIMED]),
            )
            .limit(1)
        )
        if active_wish is not None:
            return True
        active_gift = self.session.scalar(
            select(Gift.id)
            .where(
                or_(Gift.donor_id == user_id, Gift.recipient_id == user_id),
                Gift.status.in_(list(_UNRESOLVED_GIFT_STATUSES)),
            )
            .limit(1)
        )
        return active_gift is not None

    def _deletion_response(self, row: AccountDeletionRequest) -> DeletionRequestResponse:
        return DeletionRequestResponse(
            id=row.id,
            status=row.status,
            reason=(
                self.crypto.decrypt(row.reason_encrypted, context="deletion.reason")
                if row.reason_encrypted
                else None
            ),
            requested_at=row.requested_at,
            cancelled_at=row.cancelled_at,
        )

    def list_outbox_dead_letters(
        self,
        query: str | None = None,
        event_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> OutboxDeadLetterList:
        conditions: list[ColumnElement[bool]] = [OutboxEvent.dead_letter_reason.is_not(None)]
        if event_type:
            conditions.append(OutboxEvent.event_type == event_type)
        if query and query.strip():
            term = query.strip().lower()
            conditions.append(
                or_(
                    func.lower(OutboxEvent.event_type).contains(term),
                    func.lower(OutboxEvent.aggregate_type).contains(term),
                    func.lower(OutboxEvent.dead_letter_reason).contains(term),
                )
            )
        total = int(self.session.scalar(select(func.count(OutboxEvent.id)).where(*conditions)) or 0)
        rows = list(
            self.session.scalars(
                select(OutboxEvent)
                .where(*conditions)
                .order_by(OutboxEvent.created_at.desc(), OutboxEvent.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        return OutboxDeadLetterList(
            dead_letters=[
                OutboxDeadLetterResponse(
                    id=row.id,
                    aggregate_type=row.aggregate_type,
                    aggregate_id=row.aggregate_id,
                    event_type=row.event_type,
                    payload=row.payload,
                    attempts=row.attempts,
                    dead_letter_reason=row.dead_letter_reason,
                    created_at=row.created_at,
                )
                for row in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    def audit_logs(
        self,
        query: str | None = None,
        target_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AdminAuditLogList:
        conditions = []
        if target_type:
            conditions.append(AdminAuditLog.target_type == target_type)
        if query and query.strip():
            term = query.strip().lower()
            conditions.append(
                or_(
                    func.lower(AdminAuditLog.action).contains(term),
                    func.lower(AdminAuditLog.target_type).contains(term),
                    func.lower(AdminAuditLog.request_id).contains(term),
                    func.lower(User.display_name).contains(term),
                )
            )
        total = int(
            self.session.scalar(
                select(func.count(AdminAuditLog.id))
                .select_from(AdminAuditLog)
                .join(User, AdminAuditLog.actor_id == User.id)
                .where(*conditions)
            )
            or 0
        )
        entries = list(
            self.session.scalars(
                select(AdminAuditLog)
                .join(User, AdminAuditLog.actor_id == User.id)
                .where(*conditions)
                .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
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
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    def _mfa_token(self, user: User, session_id: UUID) -> tuple[str, datetime]:
        return create_mfa_token(
            self.settings,
            user_id=str(user.id),
            session_id=str(session_id),
        )

    def _ttl_seconds(self, expires_at: datetime) -> int:
        return max(0, int((expires_at - datetime.now(UTC)).total_seconds()))
