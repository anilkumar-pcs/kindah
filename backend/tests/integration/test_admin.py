from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.security import totp_code
from app.modules.admin.models import AdminAuditLog, ModerationAction
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
