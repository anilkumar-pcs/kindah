from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import totp_code
from app.main import create_app
from app.modules.admin.models import AdminAuditLog, ModerationAction, ModerationAppeal
from app.modules.identity.models import User, UserRole, UserStatus
from app.modules.wishes.models import Wish, WishStatus
from tests.integration.helpers import admin_mfa_headers, complete_setup
from tests.integration.test_discovery import _create_wish
from tests.integration.test_gifts import _create_gift

pytestmark = pytest.mark.integration


def _set_role(user_id: str, role: UserRole) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            user = db.get(User, UUID(user_id))
            assert user is not None
            user.role = role
            db.commit()
    finally:
        engine.dispose()


def test_admin_mfa_enforcement_recovery_and_audit(client: TestClient) -> None:
    session, headers, _ = complete_setup(
        client,
        phone="9876502001",
        display_name="MfaAdmin",
        vpa="mfaadmin@okhdfc",
    )
    user_id = str(session["user"]["id"])

    assert client.get("/api/v1/admin/mfa/status", headers=headers).status_code == 403

    _set_role(user_id, UserRole.ADMIN)
    status = client.get("/api/v1/admin/mfa/status", headers=headers)
    assert status.status_code == 200
    assert status.json()["role"] == "ADMIN"
    assert status.json()["mfaEnabled"] is False

    blocked = client.get("/api/v1/admin/reports", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "MFA_SETUP_REQUIRED"

    setup = client.post("/api/v1/admin/mfa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    assert setup.json()["otpauthUri"].startswith("otpauth://totp/")

    wrong = client.post(
        "/api/v1/admin/mfa/enable",
        headers=headers,
        json={"code": "000000"},
    )
    assert wrong.status_code == 422

    enabled = client.post(
        "/api/v1/admin/mfa/enable",
        headers=headers,
        json={"code": totp_code(secret)},
    )
    assert enabled.status_code == 200, enabled.text
    recovery_codes = enabled.json()["recoveryCodes"]
    assert len(recovery_codes) == 10
    mfa_headers = {**headers, "X-Admin-MFA": enabled.json()["mfaToken"]}

    assert client.get("/api/v1/admin/reports", headers=mfa_headers).status_code == 200
    no_header = client.get("/api/v1/admin/reports", headers=headers)
    assert no_header.status_code == 403
    assert no_header.json()["code"] == "MFA_REQUIRED"
    invalid_token = client.get(
        "/api/v1/admin/reports",
        headers={**headers, "X-Admin-MFA": "not-a-token"},
    )
    assert invalid_token.status_code == 403

    replay = client.post(
        "/api/v1/admin/mfa/verify",
        headers=headers,
        json={"code": totp_code(secret, at=datetime.now(UTC) - timedelta(seconds=30))},
    )
    assert replay.status_code == 401

    next_step = datetime.now(UTC) + timedelta(seconds=30)
    verified = client.post(
        "/api/v1/admin/mfa/verify",
        headers=headers,
        json={"code": totp_code(secret, at=next_step)},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["method"] == "TOTP"

    recovery = client.post(
        "/api/v1/admin/mfa/verify",
        headers=headers,
        json={"code": recovery_codes[0]},
    )
    assert recovery.status_code == 200, recovery.text
    assert recovery.json()["method"] == "RECOVERY"
    reused = client.post(
        "/api/v1/admin/mfa/verify",
        headers=headers,
        json={"code": recovery_codes[0]},
    )
    assert reused.status_code == 401
    status_after = client.get("/api/v1/admin/mfa/status", headers=headers)
    assert status_after.json()["recoveryCodesRemaining"] == 9

    audit_headers = {**headers, "X-Admin-MFA": recovery.json()["mfaToken"]}
    audits = client.get("/api/v1/admin/audit-logs", headers=audit_headers)
    assert audits.status_code == 200, audits.text
    actions = [entry["action"] for entry in audits.json()["logs"]]
    assert "ADMIN_MFA_ENABLED" in actions
    assert "ADMIN_MFA_RECOVERY_USED" in actions
    assert all("secret" not in str(entry).lower() for entry in audits.json()["logs"])
    assert client.put("/api/v1/admin/audit-logs", headers=audit_headers).status_code == 405

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            logs = list(db.scalars(select(AdminAuditLog)))
            assert len(logs) >= 2
            assert db.scalar(text("select count(*) from admin_audit_logs")) == len(logs)
            with pytest.raises(DBAPIError):
                db.execute(text("update admin_audit_logs set action = 'TAMPERED'"))
                db.commit()
            db.rollback()
    finally:
        engine.dispose()


def _admin_with_mfa(
    client: TestClient, phone: str, name: str
) -> tuple[dict[str, Any], dict[str, str]]:
    session, headers, _ = complete_setup(
        client,
        phone=phone,
        display_name=name,
        vpa=f"{name.lower()}@okhdfc",
    )
    _set_role(str(session["user"]["id"]), UserRole.ADMIN)
    return session, admin_mfa_headers(client, headers)


def test_user_moderation_actions_and_guards(client: TestClient) -> None:
    admin_session, admin_headers = _admin_with_mfa(client, "9876502011", "ActionAdmin")
    target_session, target_headers, _ = complete_setup(
        client,
        phone="9876502012",
        display_name="ActionTarget",
        vpa="actiontarget@okaxis",
    )
    target_id = str(target_session["user"]["id"])
    admin_id = str(admin_session["user"]["id"])

    warn = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "WARN", "reason": "First gentle warning."},
    )
    assert warn.status_code == 200, warn.text
    assert warn.json()["action"] == "WARN"

    restricted = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "RESTRICT", "reason": "Repeated spam reports."},
    )
    assert restricted.status_code == 200, restricted.text
    blocked_wish = client.post(
        "/api/v1/wishes",
        headers=target_headers,
        json={"message": "This should not be allowed.", "mood": "JUST_BECAUSE"},
    )
    assert blocked_wish.status_code == 403
    assert blocked_wish.json()["code"] == "ACCOUNT_RESTRICTED"
    inbox = client.get("/api/v1/me/notifications", headers=target_headers)
    assert any(
        item["notificationType"] == "ACCOUNT_MODERATION" for item in inbox.json()["notifications"]
    )

    reactivated = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "REACTIVATE", "reason": "Appeal accepted."},
    )
    assert reactivated.status_code == 200
    can_post = client.post(
        "/api/v1/wishes",
        headers=target_headers,
        json={"message": "Back after review with a kind wish.", "mood": "JUST_BECAUSE"},
    )
    assert can_post.status_code == 201, can_post.text

    suspended = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "SUSPEND", "reason": "Temporary safety hold."},
    )
    assert suspended.status_code == 200
    invalid_restrict = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "RESTRICT", "reason": "Cannot downgrade a suspension."},
    )
    assert invalid_restrict.status_code == 422

    banned = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "BAN", "reason": "Severe repeated abuse."},
    )
    assert banned.status_code == 200
    self_action = client.post(
        f"/api/v1/admin/users/{admin_id}/actions",
        headers=admin_headers,
        json={"action": "WARN", "reason": "Self moderation attempt."},
    )
    assert self_action.status_code == 422
    assert self_action.json()["code"] == "CANNOT_MODERATE_SELF"

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            target = db.get(User, UUID(target_id))
            assert target is not None
            assert target.status == UserStatus.BANNED
            assert target.trust_strikes == 1
            actions = list(db.scalars(select(ModerationAction)))
            assert [row.action.value for row in actions] == [
                "WARN",
                "RESTRICT",
                "REACTIVATE",
                "SUSPEND",
                "BAN",
            ]
            assert all("gentle warning" not in row.reason_encrypted for row in actions)
    finally:
        engine.dispose()


def test_wish_moderation_state_guards_and_audit(client: TestClient) -> None:
    _, admin_headers = _admin_with_mfa(client, "9876502021", "WishAdmin")
    _, owner_headers, _ = complete_setup(
        client,
        phone="9876502022",
        display_name="ModeratedOwner",
        vpa="moderatedowner@okhdfc",
    )
    _, viewer_headers, _ = complete_setup(
        client,
        phone="9876502025",
        display_name="ModerationViewer",
        vpa="moderationviewer@okaxis",
    )
    wish = _create_wish(client, owner_headers)

    hidden = client.post(
        f"/api/v1/admin/wishes/{wish['id']}/actions",
        headers=admin_headers,
        json={"action": "HIDE", "reason": "Under moderator review."},
    )
    assert hidden.status_code == 200, hidden.text
    assert client.get(f"/api/v1/wishes/{wish['id']}", headers=viewer_headers).status_code == 404

    restored = client.post(
        f"/api/v1/admin/wishes/{wish['id']}/actions",
        headers=admin_headers,
        json={"action": "RESTORE", "reason": "Content reviewed and allowed."},
    )
    assert restored.status_code == 200
    assert client.get(f"/api/v1/wishes/{wish['id']}", headers=viewer_headers).status_code == 200

    removed = client.post(
        f"/api/v1/admin/wishes/{wish['id']}/actions",
        headers=admin_headers,
        json={"action": "REMOVE", "reason": "Violates community guidelines."},
    )
    assert removed.status_code == 200
    assert client.get(f"/api/v1/wishes/{wish['id']}", headers=viewer_headers).status_code == 404

    restore_removed = client.post(
        f"/api/v1/admin/wishes/{wish['id']}/actions",
        headers=admin_headers,
        json={"action": "RESTORE", "reason": "Cannot restore removed."},
    )
    assert restore_removed.status_code == 422

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            row = db.get(Wish, wish["id"])
            assert row is not None
            assert row.status == WishStatus.REMOVED
            assert row.closed_reason == "REMOVED_BY_MODERATION"
            assert row.cooldown_until is None
    finally:
        engine.dispose()

    second_wish = _create_wish(client, owner_headers)
    donor_session, donor_headers, _ = complete_setup(
        client,
        phone="9876502023",
        display_name="WishDonor",
        vpa="wishdonor@okaxis",
    )
    gift = _create_gift(client, donor_headers, second_wish["id"])
    assert gift.status_code == 201, gift.text
    unresolved_remove = client.post(
        f"/api/v1/admin/wishes/{second_wish['id']}/actions",
        headers=admin_headers,
        json={"action": "REMOVE", "reason": "Must wait for the gift to resolve."},
    )
    assert unresolved_remove.status_code == 422
    assert donor_session["user"]["id"]

    _, expired_owner_headers, _ = complete_setup(
        client,
        phone="9876502024",
        display_name="ExpiredOwner",
        vpa="expiredowner@okhdfc",
    )
    expired = _create_wish(
        client,
        expired_owner_headers,
        message="A wish that will be expired for restore testing.",
    )
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            row = db.get(Wish, expired["id"])
            assert row is not None
            row.status = WishStatus.UNDER_REVIEW
            row.created_at = datetime.now(UTC) - timedelta(hours=25)
            row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
            db.commit()
    finally:
        engine.dispose()
    expired_restore = client.post(
        f"/api/v1/admin/wishes/{expired['id']}/actions",
        headers=admin_headers,
        json={"action": "RESTORE", "reason": "Expired wishes cannot restore."},
    )
    assert expired_restore.status_code == 422

    audits = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    actions = [entry["action"] for entry in audits.json()["logs"]]
    assert "WISH_HIDDEN" in actions
    assert "WISH_RESTORED" in actions
    assert "WISH_REMOVED" in actions
    assert all(entry["requestId"] for entry in audits.json()["logs"])


def test_appeal_workflow_admin_resolution_and_banned_access(client: TestClient) -> None:
    _, admin_headers = _admin_with_mfa(client, "9876502031", "AppealAdmin")
    _, target_headers, _ = complete_setup(
        client,
        phone="9876502032",
        display_name="AppealTarget",
        vpa="appealtarget@okaxis",
    )
    target_id = str(client.get("/api/v1/me", headers=target_headers).json()["id"])

    warn = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "WARN", "reason": "Warning before restriction."},
    )
    assert warn.status_code == 200
    warn_id = warn.json()["id"]

    actions = client.get("/api/v1/me/moderation-actions", headers=target_headers)
    assert actions.status_code == 200, actions.text
    assert actions.json()["actions"][0]["canAppeal"] is False
    warn_appeal = client.post(
        f"/api/v1/me/moderation-actions/{warn_id}/appeals",
        headers=target_headers,
        json={"reason": "I disagree with this warning entirely."},
    )
    assert warn_appeal.status_code == 422

    restricted = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "RESTRICT", "reason": "Repeated inappropriate messages."},
    )
    assert restricted.status_code == 200
    action_id = restricted.json()["id"]

    actions = client.get("/api/v1/me/moderation-actions", headers=target_headers)
    assert actions.status_code == 200
    restrict_action = next(item for item in actions.json()["actions"] if item["id"] == action_id)
    assert restrict_action["canAppeal"] is True
    assert restrict_action["reason"] == "Repeated inappropriate messages."

    appeal = client.post(
        f"/api/v1/me/moderation-actions/{action_id}/appeals",
        headers=target_headers,
        json={"reason": "Please review my context; I believe this was a mistake."},
    )
    assert appeal.status_code == 201, appeal.text
    appeal_id = appeal.json()["id"]
    duplicate = client.post(
        f"/api/v1/me/moderation-actions/{action_id}/appeals",
        headers=target_headers,
        json={"reason": "Trying to send a second appeal."},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "APPEAL_EXISTS"

    assert client.get("/api/v1/admin/appeals", headers=target_headers).status_code == 403
    queue = client.get("/api/v1/admin/appeals", headers=admin_headers)
    assert queue.status_code == 200, queue.text
    queued = queue.json()["appeals"]
    assert len(queued) == 1
    assert queued[0]["userDisplayName"] == "AppealTarget"
    assert queued[0]["action"] == "RESTRICT"
    assert queued[0]["actionReason"] == "Repeated inappropriate messages."
    assert "Please review my context" in queued[0]["reason"]

    resolved = client.post(
        f"/api/v1/admin/appeals/{appeal_id}/resolve",
        headers=admin_headers,
        json={
            "outcome": "ACCEPTED",
            "resolutionNote": "Context reviewed; restriction will be lifted separately.",
        },
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "ACCEPTED"
    assert resolved.json()["resolvedByDisplayName"] == "AppealAdmin"
    again = client.post(
        f"/api/v1/admin/appeals/{appeal_id}/resolve",
        headers=admin_headers,
        json={"outcome": "REJECTED", "resolutionNote": "Already resolved."},
    )
    assert again.status_code == 422

    mine = client.get("/api/v1/me/appeals", headers=target_headers)
    assert mine.status_code == 200
    assert mine.json()["appeals"][0]["status"] == "ACCEPTED"
    assert "lifted separately" in mine.json()["appeals"][0]["resolutionNote"]
    inbox = client.get("/api/v1/me/notifications", headers=target_headers)
    assert any(
        item["notificationType"] == "APPEAL_RESOLVED" for item in inbox.json()["notifications"]
    )
    assert client.get("/api/v1/me", headers=target_headers).json()["status"] == "RESTRICTED"

    banned = client.post(
        f"/api/v1/admin/users/{target_id}/actions",
        headers=admin_headers,
        json={"action": "BAN", "reason": "Escalated after review."},
    )
    assert banned.status_code == 200
    ban_appeal = client.post(
        f"/api/v1/me/moderation-actions/{banned.json()['id']}/appeals",
        headers=target_headers,
        json={"reason": "I am appealing the ban decision with new context."},
    )
    assert ban_appeal.status_code == 201, ban_appeal.text

    audits = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert "APPEAL_ACCEPTED" in [entry["action"] for entry in audits.json()["logs"]]

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            rows = list(db.scalars(select(ModerationAppeal)))
            assert len(rows) == 2
            assert all("appealing" not in row.reason_encrypted for row in rows)
    finally:
        engine.dispose()


def test_admin_can_search_users_and_change_roles(client: TestClient) -> None:
    admin_session, admin_headers = _admin_with_mfa(client, "9876502041", "RoleAdmin")
    target_session, target_headers, _ = complete_setup(
        client,
        phone="9876502042",
        display_name="RoleTarget",
        vpa="roletarget@okaxis",
    )
    target_id = str(target_session["user"]["id"])
    admin_id = str(admin_session["user"]["id"])

    search = client.get(
        "/api/v1/admin/users", headers=admin_headers, params={"query": "roletarget"}
    )
    assert search.status_code == 200, search.text
    assert search.json()["users"][0]["role"] == "USER"
    assert "phone" not in str(search.json()).lower()

    promoted = client.patch(
        f"/api/v1/admin/users/{target_id}/role",
        headers=admin_headers,
        json={"role": "ADMIN", "reason": "Owner-approved bootstrap promotion."},
    )
    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["role"] == "ADMIN"
    assert (
        client.get(
            "/api/v1/admin/users", headers=admin_headers, params={"query": "RoleTarget"}
        ).json()["users"][0]["role"]
        == "ADMIN"
    )
    inbox = client.get("/api/v1/me/notifications", headers=target_headers)
    assert any(
        item["notificationType"] == "ACCOUNT_ROLE_CHANGED" for item in inbox.json()["notifications"]
    )

    self_change = client.patch(
        f"/api/v1/admin/users/{admin_id}/role",
        headers=admin_headers,
        json={"role": "USER", "reason": "Trying to demote myself."},
    )
    assert self_change.status_code == 422
    assert self_change.json()["code"] == "CANNOT_CHANGE_OWN_ROLE"

    audits = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert any(entry["action"] == "USER_ROLE_CHANGED" for entry in audits.json()["logs"])


def test_badge_definitions_are_admin_configurable(client: TestClient) -> None:
    _, admin_headers = _admin_with_mfa(client, "9876502051", "BadgeAdmin")
    code = f"TEST_{uuid.uuid4().hex[:8].upper()}"

    created = client.post(
        "/api/v1/admin/badges",
        headers=admin_headers,
        json={
            "code": code,
            "label": "Test badge",
            "ruleType": "CONFIRMED_SENT",
            "threshold": 2,
            "active": True,
            "sortOrder": 90,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["ruleType"] == "CONFIRMED_SENT"

    updated = client.patch(
        f"/api/v1/admin/badges/{code}",
        headers=admin_headers,
        json={"label": "Updated test badge", "threshold": 1},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["label"] == "Updated test badge"
    assert updated.json()["threshold"] == 1

    deactivated = client.delete(f"/api/v1/admin/badges/{code}", headers=admin_headers)
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False
    listing = client.get("/api/v1/admin/badges", headers=admin_headers)
    assert any(
        item["code"] == code and item["active"] is False for item in listing.json()["badges"]
    )

    _, ordinary_headers, _ = complete_setup(
        client,
        phone="9876502052",
        display_name="BadgeOrdinary",
        vpa="badgeordinary@okaxis",
    )
    assert client.get("/api/v1/admin/badges", headers=ordinary_headers).status_code == 403

    audits = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    actions = [entry["action"] for entry in audits.json()["logs"]]
    assert "BADGE_DEFINITION_CREATED" in actions
    assert "BADGE_DEFINITION_UPDATED" in actions
    assert "BADGE_DEFINITION_DEACTIVATED" in actions


def test_admin_role_works_without_mfa_when_owner_disables_it(settings: Settings) -> None:
    app = create_app(settings.model_copy(update={"admin_mfa_required": False}))
    with TestClient(app) as client:
        session, headers, _ = complete_setup(
            client,
            phone="9876502061",
            display_name="RoleOnlyAdmin",
            vpa="roleonlyadmin@okhdfc",
        )
        _set_role(str(session["user"]["id"]), UserRole.ADMIN)

        status = client.get("/api/v1/admin/mfa/status", headers=headers)
        assert status.status_code == 200
        assert status.json()["mfaRequired"] is False
        assert client.get("/api/v1/admin/reports", headers=headers).status_code == 200
        assert client.get("/api/v1/admin/users", headers=headers).status_code == 200


def test_non_admin_cannot_use_mfa_or_audit_endpoints(client: TestClient) -> None:
    _, headers, _ = complete_setup(
        client,
        phone="9876502002",
        display_name="OrdinaryUser",
        vpa="ordinary@okaxis",
    )

    assert client.get("/api/v1/admin/mfa/status", headers=headers).status_code == 403
    assert client.post("/api/v1/admin/mfa/setup", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/audit-logs", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/reports", headers=headers).status_code == 403
