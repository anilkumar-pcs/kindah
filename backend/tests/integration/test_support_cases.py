from __future__ import annotations

import os
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.modules.identity.models import AuthEvent
from tests.integration.helpers import admin_mfa_headers, complete_setup
from tests.integration.test_gifts import _create_gift, _outcome, _setup

pytestmark = pytest.mark.integration


def _open_case(
    client: TestClient,
    headers: dict[str, str],
    gift_id: str,
    description: str = "I paid after the timer ended but the wish was released.",
) -> Any:
    return client.post(
        f"/api/v1/gifts/{gift_id}/support-cases",
        headers=headers,
        json={"caseType": "LATE_PAYMENT", "description": description},
    )


def test_participant_report_admin_visibility_and_resolution(settings: Settings) -> None:
    app = create_app(settings)
    with TestClient(app) as client:
        _, donor_headers, _, recipient_headers, wish = _setup(client)
        gift = _create_gift(client, donor_headers, wish["id"]).json()
        assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200

        opened = _open_case(client, donor_headers, gift["giftId"])
        assert opened.status_code == 201, opened.text
        case = opened.json()
        assert case["caseType"] == "LATE_PAYMENT"
        assert case["status"] == "OPEN"
        assert "description" not in case

        duplicate = _open_case(client, donor_headers, gift["giftId"])
        assert duplicate.status_code == 409
        assert duplicate.json()["code"] == "SUPPORT_CASE_EXISTS"

        admin_session, admin_headers, _ = complete_setup(
            client,
            phone="9876500801",
            display_name="AdminUser",
            vpa="admin@okhdfc",
        )
        admin_id = str(admin_session["user"]["id"])

        assert client.get("/api/v1/admin/support-cases", headers=donor_headers).status_code == 403

    admin_settings = settings.model_copy(update={"admin_user_ids": admin_id})
    admin_app = create_app(admin_settings)
    with TestClient(admin_app) as admin_client:
        admin_headers = admin_mfa_headers(admin_client, admin_headers)
        listing = admin_client.get(
            "/api/v1/admin/support-cases",
            headers=admin_headers,
        )
        assert listing.status_code == 200, listing.text
        cases = listing.json()["cases"]
        assert len(cases) == 1
        detail = cases[0]
        assert detail["id"] == case["id"]
        assert detail["giftId"] == gift["giftId"]
        assert detail["donorDisplayName"] == "DonorOne"
        assert detail["recipientDisplayName"] == "RecipientOne"
        assert detail["amountInr"] == 25
        assert detail["paymentRefCode"] == gift["paymentRefCode"]
        assert detail["recipientMaskedVpa"] == "re***@okaxis"
        assert detail["giftStatus"] == "DONOR_CLAIMED_PAID"
        assert "I paid after the timer" in detail["description"]
        assert "upi://" not in str(detail)
        assert "recipient1@okaxis" not in str(detail)

        resolved = admin_client.post(
            f"/api/v1/admin/support-cases/{case['id']}/resolve",
            headers=admin_headers,
            json={"resolutionNote": "Reviewed with support; no refund or reassignment."},
        )
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["status"] == "RESOLVED"
        assert "Reviewed with support" in resolved.json()["resolutionNote"]

        again = admin_client.post(
            f"/api/v1/admin/support-cases/{case['id']}/resolve",
            headers=admin_headers,
            json={"resolutionNote": "Trying to resolve twice."},
        )
        assert again.status_code == 422

        audit = admin_client.get("/api/v1/admin/audit-logs", headers=admin_headers)
        assert audit.status_code == 200, audit.text
        support_audits = [
            entry for entry in audit.json()["logs"] if entry["action"] == "SUPPORT_CASE_RESOLVED"
        ]
        assert len(support_audits) == 1
        assert support_audits[0]["reason"] == "Reviewed with support; no refund or reassignment."
        assert support_audits[0]["targetId"] == case["id"]
        assert support_audits[0]["requestId"]

        assert (
            admin_client.get(
                f"/api/v1/gifts/{gift['giftId']}",
                headers=recipient_headers,
            ).status_code
            == 200
        )

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            events = list(
                db.scalars(
                    select(AuthEvent).where(
                        AuthEvent.event_type.in_(["SUPPORT_CASE_CREATED", "SUPPORT_CASE_RESOLVED"])
                    )
                )
            )
            assert {event.event_type for event in events} == {
                "SUPPORT_CASE_CREATED",
                "SUPPORT_CASE_RESOLVED",
            }
            metadata = str([event.event_metadata for event in events])
            assert "I paid after" not in metadata
            assert "upi://" not in metadata
            assert "recipient1@okaxis" not in metadata
    finally:
        engine.dispose()


def test_non_participant_cannot_open_case(settings: Settings) -> None:
    app = create_app(settings)
    with TestClient(app) as client:
        _, donor_headers, _, _, wish = _setup(client)
        gift = _create_gift(client, donor_headers, wish["id"]).json()
        _, outsider_headers, _ = complete_setup(
            client,
            phone="9876500802",
            display_name="OutsiderUser",
            vpa="outsider@okhdfc",
        )

        response = _open_case(client, outsider_headers, gift["giftId"])

    assert response.status_code == 404
