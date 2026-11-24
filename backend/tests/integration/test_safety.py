from __future__ import annotations

import os
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.modules.identity.models import AuthEvent, UserRole
from app.modules.safety.models import ModerationReport
from app.modules.wishes.models import Wish, WishStatus
from tests.integration.helpers import (
    admin_mfa_headers,
    complete_setup,
    set_user_role,
)
from tests.integration.test_discovery import _create_wish
from tests.integration.test_gifts import _create_gift


def _report_wish(
    client: TestClient,
    headers: dict[str, str],
    wish_id: str,
    reason: str = "HARASSMENT_ABUSE",
) -> Any:
    return client.post(
        f"/api/v1/wishes/{wish_id}/reports",
        headers=headers,
        json={"reason": reason},
    )


def test_wish_report_is_deduplicated_and_private(client: TestClient) -> None:
    owner_session, owner_headers, _ = complete_setup(
        client,
        phone="9876501001",
        display_name="ReportOwner",
        vpa="reportowner@okhdfc",
    )
    reporter_session, reporter_headers, _ = complete_setup(
        client,
        phone="9876501002",
        display_name="ReporterUser",
        vpa="reporter@okaxis",
    )
    wish = _create_wish(client, owner_headers)

    first = _report_wish(client, reporter_headers, wish["id"])
    assert first.status_code == 201, first.text
    report = first.json()
    assert report["targetType"] == "WISH"
    assert report["targetId"] == wish["id"]
    assert report["reason"] == "HARASSMENT_ABUSE"
    assert report["status"] == "OPEN"
    assert "reporter" not in str(report).lower()
    assert str(reporter_session["user"]["id"]) not in str(report)

    duplicate = _report_wish(client, reporter_headers, wish["id"], reason="SPAM_BOT")
    assert duplicate.status_code == 200, duplicate.text
    assert duplicate.json()["id"] == report["id"]

    invalid = _report_wish(client, reporter_headers, wish["id"], reason="NOT_A_REASON")
    assert invalid.status_code == 422

    own = _report_wish(client, owner_headers, wish["id"])
    assert own.status_code == 422
    assert own.json()["code"] == "CANNOT_REPORT_SELF"

    missing = _report_wish(
        client,
        reporter_headers,
        "00000000-0000-0000-0000-000000000000",
    )
    assert missing.status_code == 404

    current_user = client.get("/api/v1/me", headers=owner_headers)
    assert current_user.status_code == 200
    assert owner_session["user"]["id"] and reporter_session["user"]["id"]

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert db.scalar(select(func.count(ModerationReport.id))) == 1
            events = list(
                db.scalars(select(AuthEvent).where(AuthEvent.event_type == "REPORT_CREATED"))
            )
            assert len(events) == 1
            assert events[0].event_metadata["targetType"] == "WISH"
            assert "ReporterUser" not in str(events[0].event_metadata)
    finally:
        engine.dispose()


def test_report_rate_limit_is_enforced(settings: Settings) -> None:
    app = create_app(settings.model_copy(update={"report_rate_limit_per_hour": 1}))
    with TestClient(app) as client:
        owner_headers, reporter_headers = _two_users(client)
        _, second_owner_headers, _ = complete_setup(
            client,
            phone="9876501023",
            display_name="RateOwnerTwo",
            vpa="rateownertwo@okhdfc",
        )
        first_wish = _create_wish(client, owner_headers)
        second_wish = _create_wish(client, second_owner_headers)

        assert _report_wish(client, reporter_headers, first_wish["id"]).status_code == 201
        limited = _report_wish(client, reporter_headers, second_wish["id"], reason="SPAM_BOT")
        assert limited.status_code == 429
        assert limited.json()["code"] == "REPORT_RATE_LIMITED"


def test_block_unblock_excludes_discovery_and_interactions(client: TestClient) -> None:
    owner_session, owner_headers, _ = complete_setup(
        client,
        phone="9876501011",
        display_name="BlockListOwner",
        vpa="blocklistowner@okhdfc",
    )
    viewer_session, viewer_headers, _ = complete_setup(
        client,
        phone="9876501012",
        display_name="BlockListViewer",
        vpa="blocklistviewer@okaxis",
    )
    owner_id = str(owner_session["user"]["id"])
    viewer_id = str(viewer_session["user"]["id"])
    owner_wish = _create_wish(client, owner_headers)
    viewer_wish = _create_wish(
        client,
        viewer_headers,
        message="A different wish from the viewing account",
    )

    blocked = client.post(f"/api/v1/users/{owner_id}/block", headers=viewer_headers)
    assert blocked.status_code == 201, blocked.text
    assert blocked.json()["blockedUserId"] == owner_id

    duplicate = client.post(f"/api/v1/users/{owner_id}/block", headers=viewer_headers)
    assert duplicate.status_code == 200

    blocks = client.get("/api/v1/me/blocks", headers=viewer_headers)
    assert blocks.status_code == 200
    assert blocks.json()["blockedUsers"][0]["blockedUserId"] == owner_id
    assert blocks.json()["blockedUsers"][0]["displayName"] == "BlockListOwner"

    viewer_feed = client.get("/api/v1/wishes", headers=viewer_headers)
    assert owner_wish["id"] not in [item["id"] for item in viewer_feed.json()["wishes"]]
    owner_feed = client.get("/api/v1/wishes", headers=owner_headers)
    assert viewer_wish["id"] not in [item["id"] for item in owner_feed.json()["wishes"]]

    assert (
        client.get(f"/api/v1/wishes/{owner_wish['id']}", headers=viewer_headers).status_code == 404
    )
    assert (
        client.get(f"/api/v1/wishes/{viewer_wish['id']}", headers=owner_headers).status_code == 404
    )
    selected = client.post(
        f"/api/v1/wishes/{owner_wish['id']}/select",
        headers=viewer_headers,
    )
    assert selected.status_code == 409
    gift = _create_gift(client, viewer_headers, owner_wish["id"])
    assert gift.status_code == 409
    assert gift.json()["code"] == "WISH_UNAVAILABLE"

    assert _report_wish(client, viewer_headers, owner_wish["id"]).status_code == 404
    user_report = client.post(
        f"/api/v1/users/{owner_id}/reports",
        headers=viewer_headers,
        json={"reason": "HARASSMENT_ABUSE"},
    )
    assert user_report.status_code == 404

    self_block = client.post(f"/api/v1/users/{viewer_id}/block", headers=viewer_headers)
    assert self_block.status_code == 422
    assert self_block.json()["code"] == "CANNOT_BLOCK_SELF"

    unblocked = client.delete(f"/api/v1/users/{owner_id}/block", headers=viewer_headers)
    assert unblocked.status_code == 204
    assert (
        client.delete(f"/api/v1/users/{owner_id}/block", headers=viewer_headers).status_code == 204
    )
    viewer_feed = client.get("/api/v1/wishes", headers=viewer_headers)
    assert owner_wish["id"] in [item["id"] for item in viewer_feed.json()["wishes"]]
    assert client.get("/api/v1/me/blocks", headers=viewer_headers).json()["blockedUsers"] == []

    alias_block = client.post(
        f"/api/v1/wishes/{owner_wish['id']}/block-owner",
        headers=viewer_headers,
    )
    assert alias_block.status_code == 201
    assert alias_block.json()["blockedUserId"] == owner_id
    alias_unblock = client.delete(
        f"/api/v1/wishes/{owner_wish['id']}/block-owner",
        headers=viewer_headers,
    )
    assert alias_unblock.status_code == 204


def test_three_unique_reports_auto_hide_once_and_enter_admin_queue(
    client: TestClient,
    settings: Settings,
) -> None:
    owner_session, owner_headers, _ = complete_setup(
        client,
        phone="9876501031",
        display_name="HiddenWishOwner",
        vpa="hiddenowner@okhdfc",
    )
    wish = _create_wish(client, owner_headers)
    reporters: list[dict[str, str]] = []
    for index in range(1, 5):
        _, headers, _ = complete_setup(
            client,
            phone=f"987650104{index}",
            display_name=f"HideReporter{index}",
            vpa=f"hidereporter{index}@okaxis",
        )
        reporters.append(headers)

    assert _report_wish(client, reporters[0], wish["id"]).status_code == 201
    assert _report_wish(client, reporters[1], wish["id"], reason="SPAM_BOT").status_code == 201
    duplicate = _report_wish(client, reporters[0], wish["id"], reason="OTHER")
    assert duplicate.status_code == 200

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            wish_row = db.get(Wish, wish["id"])
            assert wish_row is not None
            assert wish_row.status == WishStatus.OPEN
    finally:
        engine.dispose()

    assert _report_wish(client, reporters[2], wish["id"], reason="IMPERSONATION").status_code == 201
    assert _report_wish(client, reporters[3], wish["id"], reason="OTHER").status_code == 201
    assert _report_wish(client, reporters[2], wish["id"], reason="SPAM_BOT").status_code == 200

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            wish_row = db.get(Wish, wish["id"])
            assert wish_row is not None
            assert wish_row.status == WishStatus.UNDER_REVIEW
            hidden_events = list(
                db.scalars(select(AuthEvent).where(AuthEvent.event_type == "WISH_AUTO_HIDDEN"))
            )
            assert len(hidden_events) == 1
            assert hidden_events[0].event_metadata["uniqueReports"] == 3
            assert hidden_events[0].event_metadata["threshold"] == 3
            assert "HideReporter" not in str(hidden_events[0].event_metadata)
    finally:
        engine.dispose()

    assert wish["id"] not in [item["id"] for item in client.get("/api/v1/wishes").json()["wishes"]]
    assert client.get(f"/api/v1/wishes/{wish['id']}", headers=reporters[0]).status_code == 404
    inbox = client.get("/api/v1/me/notifications", headers=owner_headers)
    assert any(
        item["notificationType"] == "WISH_UNDER_REVIEW" for item in inbox.json()["notifications"]
    )

    non_admin = client.get("/api/v1/admin/reports", headers=reporters[0])
    assert non_admin.status_code == 403

    admin_session, admin_headers, _ = complete_setup(
        client,
        phone="9876501050",
        display_name="QueueAdmin",
        vpa="queueadmin@okhdfc",
    )
    admin_id = str(admin_session["user"]["id"])
    set_user_role(admin_id, UserRole.ADMIN)
    admin_app = create_app(settings)
    with TestClient(admin_app) as admin_client:
        admin_headers = admin_mfa_headers(admin_client, admin_headers)
        queue = admin_client.get("/api/v1/admin/reports", headers=admin_headers)
        assert queue.status_code == 200, queue.text
        reports = queue.json()["reports"]
        assert len(reports) == 4
        first = reports[0]
        assert first["targetType"] == "WISH"
        assert first["targetId"] == wish["id"]
        assert first["targetDisplayName"] == "HiddenWishOwner"
        assert first["targetPreview"] == "A warm chai for a long day"
        assert first["targetStatus"] == "UNDER_REVIEW"
        assert first["uniqueReportCount"] == 4
        assert "reporter" not in str(first).lower()
        assert "98765010" not in str(reports)
        assert "hiddenowner@okhdfc" not in str(reports)

    assert owner_session["user"]["id"]


def _two_users(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    _, owner_headers, _ = complete_setup(
        client,
        phone="9876501021",
        display_name="RateOwner",
        vpa="rateowner@okhdfc",
    )
    _, reporter_headers, _ = complete_setup(
        client,
        phone="9876501022",
        display_name="RateReporter",
        vpa="ratereporter@okaxis",
    )
    return owner_headers, reporter_headers
