from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.identity.audit import record_audit_event
from app.modules.identity.models import User
from app.modules.safety.models import (
    ModerationReport,
    ReportReason,
    ReportStatus,
    ReportTargetType,
    UserBlock,
)
from app.modules.safety.schemas import (
    BlockedUserList,
    BlockedUserResponse,
    ReportCreateRequest,
    ReportResponse,
)
from app.modules.wishes.models import Wish


class SafetyService:
    def __init__(self, *, settings: Settings, session: Session) -> None:
        self.settings = settings
        self.session = session

    # ------------------------------------------------------------------
    # Reports
    # ------------------------------------------------------------------
    def report_wish(
        self,
        actor: User,
        wish_id: UUID,
        request: ReportCreateRequest,
    ) -> tuple[ReportResponse, bool]:
        wish = self.session.get(Wish, wish_id)
        if wish is None:
            raise AppError(404, "NOT_FOUND", "Wish not found", "This wish is unavailable.")
        if wish.user_id == actor.id:
            raise AppError(
                422,
                "CANNOT_REPORT_SELF",
                "Cannot report own wish",
                "You cannot report your own wish.",
            )
        if self._blocked(actor.id, wish.user_id):
            raise AppError(404, "NOT_FOUND", "Wish not found", "This wish is unavailable.")
        return self._create_report(
            actor,
            target_type=ReportTargetType.WISH,
            target_id=wish.id,
            reason=request.reason,
        )

    def report_user(
        self,
        actor: User,
        target_id: UUID,
        request: ReportCreateRequest,
    ) -> tuple[ReportResponse, bool]:
        target = self.session.get(User, target_id)
        if target is None:
            raise AppError(404, "NOT_FOUND", "User not found", "This user is unavailable.")
        if target.id == actor.id:
            raise AppError(
                422,
                "CANNOT_REPORT_SELF",
                "Cannot report yourself",
                "You cannot report your own account.",
            )
        if self._blocked(actor.id, target.id):
            raise AppError(404, "NOT_FOUND", "User not found", "This user is unavailable.")
        return self._create_report(
            actor,
            target_type=ReportTargetType.USER,
            target_id=target.id,
            reason=request.reason,
        )

    def _create_report(
        self,
        actor: User,
        *,
        target_type: ReportTargetType,
        target_id: UUID,
        reason: ReportReason,
    ) -> tuple[ReportResponse, bool]:
        existing = self._existing_report(actor.id, target_type, target_id)
        if existing is not None:
            return self._response(existing), False

        # Serialise a reporter's new reports so the hourly cap cannot be
        # exceeded by concurrent requests. The unique constraint remains the
        # final duplicate guard.
        self.session.scalar(select(User.id).where(User.id == actor.id).with_for_update())

        existing = self._existing_report(actor.id, target_type, target_id)
        if existing is not None:
            self.session.rollback()
            return self._response(existing), False

        now = datetime.now(UTC)
        window_start = now - timedelta(hours=1)
        recent_count = self.session.scalar(
            select(func.count(ModerationReport.id)).where(
                ModerationReport.reporter_id == actor.id,
                ModerationReport.created_at > window_start,
            )
        )
        if (recent_count or 0) >= self.settings.report_rate_limit_per_hour:
            self.session.rollback()
            raise AppError(
                429,
                "REPORT_RATE_LIMITED",
                "Too many reports",
                "You have submitted too many reports. Try again later.",
            )

        report = ModerationReport(
            id=uuid.uuid4(),
            reporter_id=actor.id,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            status=ReportStatus.OPEN,
            created_at=now,
            updated_at=now,
        )
        self.session.add(report)
        record_audit_event(
            session=self.session,
            event_type="REPORT_CREATED",
            user_id=actor.id,
            metadata={
                "reportId": str(report.id),
                "targetType": target_type.value,
                "targetId": str(target_id),
                "reason": reason.value,
            },
        )
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            existing = self._existing_report(actor.id, target_type, target_id)
            if existing is not None:
                return self._response(existing), False
            raise
        return self._response(report), True

    def _existing_report(
        self,
        reporter_id: UUID,
        target_type: ReportTargetType,
        target_id: UUID,
    ) -> ModerationReport | None:
        return self.session.scalar(
            select(ModerationReport).where(
                ModerationReport.reporter_id == reporter_id,
                ModerationReport.target_type == target_type,
                ModerationReport.target_id == target_id,
            )
        )

    # ------------------------------------------------------------------
    # Blocks
    # ------------------------------------------------------------------
    def block_user(self, actor: User, target_id: UUID) -> tuple[BlockedUserResponse, bool]:
        target = self.session.get(User, target_id)
        if target is None:
            raise AppError(404, "NOT_FOUND", "User not found", "This user is unavailable.")
        if target.id == actor.id:
            raise AppError(
                422,
                "CANNOT_BLOCK_SELF",
                "Cannot block yourself",
                "You cannot block your own account.",
            )

        existing = self.session.get(UserBlock, (actor.id, target.id))
        if existing is not None:
            return self._block_response(existing, target.display_name), False

        now = datetime.now(UTC)
        block = UserBlock(blocker_id=actor.id, blocked_id=target.id, created_at=now)
        self.session.add(block)
        record_audit_event(
            session=self.session,
            event_type="USER_BLOCKED",
            user_id=actor.id,
            metadata={"blockedUserId": str(target.id)},
        )
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            existing = self.session.get(UserBlock, (actor.id, target.id))
            if existing is None:
                raise
            target = self.session.get(User, target.id)
            display_name = target.display_name if target else None
            return self._block_response(existing, display_name), False
        return self._block_response(block, target.display_name), True

    def block_wish_owner(self, actor: User, wish_id: UUID) -> tuple[BlockedUserResponse, bool]:
        wish = self.session.get(Wish, wish_id)
        if wish is None:
            raise AppError(404, "NOT_FOUND", "Wish not found", "This wish is unavailable.")
        return self.block_user(actor, wish.user_id)

    def unblock_user(self, actor: User, target_id: UUID) -> bool:
        block = self.session.get(UserBlock, (actor.id, target_id))
        if block is None:
            return False
        self.session.delete(block)
        record_audit_event(
            session=self.session,
            event_type="USER_UNBLOCKED",
            user_id=actor.id,
            metadata={"unblockedUserId": str(target_id)},
        )
        self.session.commit()
        return True

    def unblock_wish_owner(self, actor: User, wish_id: UUID) -> bool:
        wish = self.session.get(Wish, wish_id)
        if wish is None:
            raise AppError(404, "NOT_FOUND", "Wish not found", "This wish is unavailable.")
        return self.unblock_user(actor, wish.user_id)

    def list_blocks(self, actor: User) -> BlockedUserList:
        rows = self.session.execute(
            select(UserBlock, User)
            .join(User, User.id == UserBlock.blocked_id)
            .where(UserBlock.blocker_id == actor.id)
            .order_by(UserBlock.created_at.desc())
        ).all()
        return BlockedUserList(
            blocked_users=[
                BlockedUserResponse(
                    blocked_user_id=block.blocked_id,
                    display_name=user.display_name,
                    created_at=block.created_at,
                )
                for block, user in rows
            ]
        )

    def _blocked(self, first_id: UUID, second_id: UUID) -> bool:
        return (
            self.session.scalar(
                select(UserBlock.blocker_id).where(
                    or_(
                        and_(
                            UserBlock.blocker_id == first_id,
                            UserBlock.blocked_id == second_id,
                        ),
                        and_(
                            UserBlock.blocker_id == second_id,
                            UserBlock.blocked_id == first_id,
                        ),
                    )
                )
            )
            is not None
        )

    # ------------------------------------------------------------------
    # Responses
    # ------------------------------------------------------------------
    def _response(self, report: ModerationReport) -> ReportResponse:
        return ReportResponse(
            id=report.id,
            target_type=report.target_type,
            target_id=report.target_id,
            reason=report.reason,
            status=report.status,
            created_at=report.created_at,
        )

    def _block_response(
        self,
        block: UserBlock,
        display_name: str | None,
    ) -> BlockedUserResponse:
        return BlockedUserResponse(
            blocked_user_id=block.blocked_id,
            display_name=display_name,
            created_at=block.created_at,
        )
