from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.security import totp_code
from app.modules.admin.models import AdminAuditLog
from app.modules.identity.models import User, UserRole
from tests.integration.helpers import complete_setup

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
