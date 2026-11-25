from __future__ import annotations

import os
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.modules.admin.models import AccountDeletionRequest
from app.modules.identity.models import User, UserRole
from tests.integration.helpers import admin_mfa_headers, complete_setup
from tests.integration.test_discovery import _create_wish
from tests.integration.test_gifts import _create_gift


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


def test_deletion_request_is_non_destructive_cancellable_and_admin_visible(
    client: TestClient,
) -> None:
    session, headers, _ = complete_setup(
        client,
        phone="9876503001",
        display_name="DeletionUser",
        vpa="deletionuser@okhdfc",
    )
    user_id = str(session["user"]["id"])
    wish = _create_wish(client, headers)

    active = client.post(
        "/api/v1/me/deletion-request",
        headers=headers,
        json={"reason": "I would like to leave."},
    )
    assert active.status_code == 409
    assert active.json()["code"] == "ACTIVE_TRANSACTIONS"

    withdrawn = client.delete(f"/api/v1/wishes/{wish['id']}", headers=headers)
    assert withdrawn.status_code == 200

    requested = client.post(
        "/api/v1/me/deletion-request",
        headers=headers,
        json={"reason": "I would like to leave."},
    )
    assert requested.status_code == 200, requested.text
    request_id = requested.json()["id"]
    assert requested.json()["status"] == "REQUESTED"
    assert requested.json()["reason"] == "I would like to leave."

    me = client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["status"] == "DELETION_PENDING"
    blocked_wish = client.post(
        "/api/v1/wishes",
        headers=headers,
        json={"message": "A wish after requesting deletion.", "mood": "JUST_BECAUSE"},
    )
    assert blocked_wish.status_code == 403
    assert blocked_wish.json()["code"] == "ACCOUNT_RESTRICTED"

    duplicate = client.post(
        "/api/v1/me/deletion-request",
        headers=headers,
        json={"reason": "Duplicate request."},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["id"] == request_id
    assert client.get("/api/v1/me/deletion-request", headers=headers).status_code == 200

    assert client.get("/api/v1/admin/deletion-requests", headers=headers).status_code == 403
    admin_session, admin_headers, _ = complete_setup(
        client,
        phone="9876503002",
        display_name="DeletionAdmin",
        vpa="deletionadmin@okhdfc",
    )
    _set_role(str(admin_session["user"]["id"]), UserRole.ADMIN)
    admin_headers = admin_mfa_headers(client, admin_headers)
    queue = client.get("/api/v1/admin/deletion-requests", headers=admin_headers)
    assert queue.status_code == 200, queue.text
    requests = queue.json()["requests"]
    assert len(requests) == 1
    assert requests[0]["userDisplayName"] == "DeletionUser"
    assert requests[0]["userStatus"] == "DELETION_PENDING"
    assert requests[0]["reason"] == "I would like to leave."

    cancelled = client.delete("/api/v1/me/deletion-request", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"
    assert client.get("/api/v1/me", headers=headers).json()["status"] == "ACTIVE"
    can_post = client.post(
        "/api/v1/wishes",
        headers=headers,
        json={"message": "Back after cancelling deletion.", "mood": "JUST_BECAUSE"},
    )
    assert can_post.status_code == 409
    assert can_post.json()["code"] == "COOLDOWN_ACTIVE"
    assert (
        client.get(
            "/api/v1/admin/deletion-requests",
            headers=admin_headers,
            params={"status": "REQUESTED"},
        ).json()["requests"]
        == []
    )

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            user = db.get(User, UUID(user_id))
            assert user is not None
            assert user.status.value == "ACTIVE"
            row = db.get(AccountDeletionRequest, UUID(request_id))
            assert row is not None
            assert "I would like" not in (row.reason_encrypted or "")
    finally:
        engine.dispose()


def test_deletion_request_blocked_by_active_gift(client: TestClient) -> None:
    _, recipient_headers, _ = complete_setup(
        client,
        phone="9876503011",
        display_name="DeletionRecipient",
        vpa="deletionrecipient@okaxis",
    )
    _, donor_headers, _ = complete_setup(
        client,
        phone="9876503012",
        display_name="DeletionDonor",
        vpa="deletiondonor@okhdfc",
    )
    wish = _create_wish(client, recipient_headers)
    gift = _create_gift(client, donor_headers, wish["id"])
    assert gift.status_code == 201, gift.text

    for headers in (recipient_headers, donor_headers):
        response = client.post(
            "/api/v1/me/deletion-request",
            headers=headers,
            json={"reason": "Deletion while a gift is unresolved."},
        )
        assert response.status_code == 409
        assert response.json()["code"] == "ACTIVE_TRANSACTIONS"
