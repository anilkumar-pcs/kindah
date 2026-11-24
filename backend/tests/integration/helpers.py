from __future__ import annotations

from typing import Any, cast

from fastapi.testclient import TestClient

TEST_PHONE = "9876543210"
TEST_CODE = "123456"


def request_and_verify(
    client: TestClient,
    phone: str = TEST_PHONE,
    code: str = TEST_CODE,
) -> dict[str, Any]:
    request = client.post("/api/v1/auth/otp/request", json={"phone": phone})
    assert request.status_code == 202, request.text
    verify = client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "code": code},
    )
    assert verify.status_code == 200, verify.text
    return cast(dict[str, Any], verify.json())


def auth_headers(session: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {session['accessToken']}"}


def record_consent(client: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    response = client.post(
        "/api/v1/me/consent",
        headers=headers,
        json={
            "ageConfirmed": True,
            "termsAccepted": True,
            "privacyAccepted": True,
            "guidelinesAccepted": True,
        },
    )
    assert response.status_code == 200, response.text
    return cast(dict[str, Any], response.json())


def complete_profile(
    client: TestClient,
    headers: dict[str, str],
    display_name: str = "ChaiLover",
) -> dict[str, Any]:
    response = client.patch(
        "/api/v1/me",
        headers=headers,
        json={
            "displayName": display_name,
            "avatar": "CHAI",
            "city": "Bengaluru",
        },
    )
    assert response.status_code == 200, response.text
    return cast(dict[str, Any], response.json())


def complete_onboarding(
    client: TestClient,
    phone: str = TEST_PHONE,
    display_name: str = "ChaiLover",
) -> tuple[dict[str, Any], dict[str, str]]:
    session = request_and_verify(client, phone=phone)
    headers = auth_headers(session)
    record_consent(client, headers)
    complete_profile(client, headers, display_name=display_name)
    return session, headers
