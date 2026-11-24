from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session

from app.modules.identity.models import User, UserSession, UserStatus
from tests.integration.helpers import (
    auth_headers,
    complete_onboarding,
    request_and_verify,
)


def _set_user_status(user_id: str, status: UserStatus) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            user = db.get(User, UUID(user_id))
            assert user is not None
            user.status = status
            db.commit()
    finally:
        engine.dispose()


def _expire_all_sessions() -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with engine.begin() as connection:
            now = datetime.now(UTC)
            connection.execute(
                update(UserSession).values(
                    created_at=now - timedelta(hours=2),
                    expires_at=now - timedelta(hours=1),
                )
            )
    finally:
        engine.dispose()


def test_access_token_is_required(client: TestClient) -> None:
    missing = client.get("/api/v1/me")
    assert missing.status_code == 401
    assert missing.json()["code"] == "AUTH_REQUIRED"

    invalid = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert invalid.status_code == 401
    assert invalid.json()["code"] == "SESSION_EXPIRED"


def test_refresh_requires_csrf(client: TestClient) -> None:
    request_and_verify(client)

    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_refresh_rotates_and_reuse_revokes_family(
    client: TestClient,
    app: FastAPI,
) -> None:
    session = request_and_verify(client)
    old_refresh = client.cookies.get("kindly_refresh")
    csrf = client.cookies.get("kindly_csrf")
    assert old_refresh
    assert csrf

    refreshed = client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": csrf},
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["accessToken"] != session["accessToken"]
    new_refresh = client.cookies.get("kindly_refresh")
    assert new_refresh
    assert new_refresh != old_refresh

    # Replaying the rotated token is treated as reuse and revokes the family.
    with TestClient(app) as replay:
        response = replay.post(
            "/api/v1/auth/refresh",
            headers={
                "X-CSRF-Token": csrf,
                "Cookie": f"kindly_refresh={old_refresh}; kindly_csrf={csrf}",
            },
        )
    assert response.status_code == 401
    assert response.json()["code"] == "SESSION_EXPIRED"

    # The current token belongs to the revoked family and must also fail.
    with TestClient(app) as after_reuse:
        response = after_reuse.post(
            "/api/v1/auth/refresh",
            headers={
                "X-CSRF-Token": csrf,
                "Cookie": f"kindly_refresh={new_refresh}; kindly_csrf={csrf}",
            },
        )
    assert response.status_code == 401


def test_logout_revokes_session(client: TestClient, app: FastAPI) -> None:
    request_and_verify(client)
    refresh_token = client.cookies.get("kindly_refresh")
    csrf = client.cookies.get("kindly_csrf")
    assert refresh_token
    assert csrf

    logout = client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": csrf},
    )
    assert logout.status_code == 204

    with TestClient(app) as replay:
        response = replay.post(
            "/api/v1/auth/refresh",
            headers={
                "X-CSRF-Token": csrf,
                "Cookie": f"kindly_refresh={refresh_token}; kindly_csrf={csrf}",
            },
        )
    assert response.status_code == 401


def test_expired_session_is_rejected(client: TestClient) -> None:
    session = complete_onboarding(client)[0]
    _expire_all_sessions()

    response = client.get("/api/v1/me", headers=auth_headers(session))

    assert response.status_code == 401
    assert response.json()["code"] == "SESSION_EXPIRED"


def test_refresh_after_session_expiry_is_rejected(client: TestClient) -> None:
    request_and_verify(client)
    csrf = client.cookies.get("kindly_csrf")
    assert csrf
    _expire_all_sessions()

    response = client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": csrf},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "SESSION_EXPIRED"


def test_restricted_user_can_read_but_not_change_profile(client: TestClient) -> None:
    session, headers = complete_onboarding(client)
    user_id = str(session["user"]["id"])
    _set_user_status(user_id, UserStatus.RESTRICTED)

    readable = client.get("/api/v1/me", headers=headers)
    assert readable.status_code == 200
    assert readable.json()["status"] == "RESTRICTED"

    blocked = client.patch(
        "/api/v1/me",
        headers=headers,
        json={"city": "Mysuru"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "ACCOUNT_RESTRICTED"

    consent = client.post(
        "/api/v1/me/consent",
        headers=headers,
        json={
            "ageConfirmed": True,
            "termsAccepted": True,
            "privacyAccepted": True,
            "guidelinesAccepted": True,
        },
    )
    assert consent.status_code == 403
    assert consent.json()["code"] == "ACCOUNT_RESTRICTED"


def test_banned_user_can_read_profile_and_appeal_but_not_interact(client: TestClient) -> None:
    session, headers = complete_onboarding(client)
    _set_user_status(str(session["user"]["id"]), UserStatus.BANNED)

    response = client.get("/api/v1/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "BANNED"

    blocked = client.post(
        "/api/v1/me/consent",
        headers=headers,
        json={
            "ageConfirmed": True,
            "termsAccepted": True,
            "privacyAccepted": True,
            "guidelinesAccepted": True,
        },
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "ACCOUNT_RESTRICTED"
