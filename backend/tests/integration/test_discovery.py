from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.modules.safety.models import UserBlock
from app.modules.wishes.models import Wish, WishMood, WishStatus
from tests.integration.helpers import complete_setup

pytestmark = pytest.mark.integration

_VALID_MESSAGE = "A warm chai for a long day"


def _create_wish(
    client: TestClient,
    headers: dict[str, str],
    *,
    city: str = "Bengaluru",
    message: str = _VALID_MESSAGE,
) -> dict[str, Any]:
    response = client.post(
        "/api/v1/wishes",
        headers=headers,
        json={
            "message": message,
            "mood": "LONG_DAY",
            "suggestedAmountInr": 25,
            "city": city,
        },
    )
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


def _insert_wish(
    *,
    user_id: str,
    status: WishStatus,
    city: str = "Bengaluru",
    created_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> UUID:
    now = datetime.now(UTC)
    wish_id = uuid.uuid4()
    wish = Wish(
        id=wish_id,
        user_id=UUID(user_id),
        message=_VALID_MESSAGE,
        mood=WishMood.JUST_BECAUSE,
        city=city,
        status=status,
        expires_at=expires_at or now + timedelta(hours=24),
        created_at=created_at or now,
        updated_at=now,
    )
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            db.add(wish)
            db.commit()
    finally:
        engine.dispose()
    return wish_id


def _add_block(blocker_id: str, blocked_id: str) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            db.add(UserBlock(blocker_id=UUID(blocker_id), blocked_id=UUID(blocked_id)))
            db.commit()
    finally:
        engine.dispose()


def _expire_wish(wish_id: UUID) -> None:
    now = datetime.now(UTC)
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            wish = db.get(Wish, wish_id)
            assert wish is not None
            wish.created_at = now - timedelta(hours=25)
            wish.expires_at = now - timedelta(hours=1)
            db.commit()
    finally:
        engine.dispose()


def test_public_feed_has_only_public_safe_fields(client: TestClient) -> None:
    _, owner_headers, _ = complete_setup(
        client,
        phone="9876500301",
        display_name="OwnerOne",
        vpa="owner1@okhdfc",
    )
    created = _create_wish(client, owner_headers)

    response = client.get("/api/v1/wishes")

    assert response.status_code == 200
    wishes = response.json()["wishes"]
    assert len(wishes) == 1
    card = wishes[0]
    assert card["id"] == created["id"]
    assert set(card) == {
        "id",
        "displayName",
        "avatar",
        "city",
        "createdAt",
        "mood",
        "message",
        "suggestedAmountInr",
        "isOwnWish",
    }
    assert card["displayName"] == "OwnerOne"
    assert card["city"] == "Bengaluru"
    assert card["isOwnWish"] is False
    forbidden = {"phone", "mobile", "vpa", "maskedVpa", "userId", "utr", "paymentRef"}
    assert forbidden.isdisjoint(card)


def test_feed_excludes_own_expired_locked_removed_and_under_review(
    client: TestClient,
) -> None:
    owner_session, owner_headers, _ = complete_setup(
        client,
        phone="9876500302",
        display_name="OwnerTwo",
        vpa="owner2@okhdfc",
    )
    viewer_session, viewer_headers, _ = complete_setup(
        client,
        phone="9876500303",
        display_name="ViewerTwo",
        vpa="viewer2@okaxis",
    )
    owner_id = str(owner_session["user"]["id"])
    viewer_id = str(viewer_session["user"]["id"])
    visible = _create_wish(client, owner_headers)

    now = datetime.now(UTC)
    _insert_wish(
        user_id=owner_id,
        status=WishStatus.EXPIRED,
        created_at=now - timedelta(hours=2),
        expires_at=now - timedelta(hours=1),
    )
    _insert_wish(user_id=owner_id, status=WishStatus.REMOVED)
    _insert_wish(user_id=owner_id, status=WishStatus.UNDER_REVIEW)
    _insert_wish(user_id=viewer_id, status=WishStatus.LOCKED)

    guest = client.get("/api/v1/wishes").json()["wishes"]
    assert [wish["id"] for wish in guest] == [visible["id"]]

    for_viewer = client.get(
        "/api/v1/wishes",
        headers=viewer_headers,
    ).json()["wishes"]
    assert [wish["id"] for wish in for_viewer] == [visible["id"]]

    for_owner = client.get(
        "/api/v1/wishes",
        headers=owner_headers,
    ).json()["wishes"]
    assert visible["id"] not in [wish["id"] for wish in for_owner]


def test_city_filter_and_fresh_cursor(client: TestClient) -> None:
    users = []
    for index, city in enumerate(("Bengaluru", "Mysuru", "Bengaluru"), start=1):
        session, headers, _ = complete_setup(
            client,
            phone=f"98765003{10 + index}",
            display_name=f"CityUser{index}",
            vpa=f"city{index}@okhdfc",
        )
        users.append((session, headers, city))
        _create_wish(client, headers, city=city)

    filtered = client.get("/api/v1/wishes", params={"city": "bengaluru"})
    assert filtered.status_code == 200
    cards = filtered.json()["wishes"]
    assert len(cards) == 2
    assert all(card["city"] == "Bengaluru" for card in cards)

    first = client.get("/api/v1/wishes", params={"limit": 2})
    body = first.json()
    assert len(body["wishes"]) == 2
    assert body["nextCursor"]

    second = client.get(
        "/api/v1/wishes",
        params={"limit": 2, "cursor": body["nextCursor"]},
    )
    second_body = second.json()
    assert len(second_body["wishes"]) == 1
    ids = {wish["id"] for wish in body["wishes"]} | {wish["id"] for wish in second_body["wishes"]}
    assert len(ids) == 3


def test_random_seed_is_stable_and_paginates(client: TestClient) -> None:
    for index in range(1, 4):
        _, headers, _ = complete_setup(
            client,
            phone=f"98765004{10 + index}",
            display_name=f"RandomUser{index}",
            vpa=f"random{index}@okhdfc",
        )
        _create_wish(client, headers)

    first = client.get(
        "/api/v1/wishes",
        params={"sort": "random", "seed": "abcdef12", "limit": 2},
    )
    second = client.get(
        "/api/v1/wishes",
        params={"sort": "random", "seed": "abcdef12", "limit": 2},
    )
    assert first.status_code == 200
    assert first.json()["seed"] == "abcdef12"
    assert [w["id"] for w in first.json()["wishes"]] == [w["id"] for w in second.json()["wishes"]]

    page_two = client.get(
        "/api/v1/wishes",
        params={
            "sort": "random",
            "seed": "abcdef12",
            "limit": 2,
            "cursor": first.json()["nextCursor"],
        },
    )
    assert page_two.status_code == 200
    assert len(page_two.json()["wishes"]) == 1


def test_detail_and_selection_eligibility(client: TestClient) -> None:
    _owner_session, owner_headers, _ = complete_setup(
        client,
        phone="9876500501",
        display_name="SelectOwner",
        vpa="selectowner@okhdfc",
    )
    _, viewer_headers, _ = complete_setup(
        client,
        phone="9876500502",
        display_name="SelectViewer",
        vpa="selectviewer@okaxis",
    )
    wish = _create_wish(client, owner_headers)

    detail = client.get(f"/api/v1/wishes/{wish['id']}")
    assert detail.status_code == 200
    assert detail.json()["message"] == _VALID_MESSAGE
    assert detail.json()["isOwnWish"] is False
    assert "phone" not in detail.json()

    owner_detail = client.get(f"/api/v1/wishes/{wish['id']}", headers=owner_headers)
    assert owner_detail.status_code == 200
    assert owner_detail.json()["isOwnWish"] is True

    viewer_detail = client.get(f"/api/v1/wishes/{wish['id']}", headers=viewer_headers)
    assert viewer_detail.status_code == 200
    assert viewer_detail.json()["isOwnWish"] is False

    assert client.post(f"/api/v1/wishes/{wish['id']}/select").status_code == 401

    blocked_owner = client.post(
        f"/api/v1/wishes/{wish['id']}/select",
        headers=owner_headers,
    )
    assert blocked_owner.status_code == 409
    assert blocked_owner.json()["code"] == "WISH_UNAVAILABLE"

    selected = client.post(
        f"/api/v1/wishes/{wish['id']}/select",
        headers=viewer_headers,
    )
    assert selected.status_code == 200
    assert selected.json()["id"] == wish["id"]

    _expire_wish(UUID(wish["id"]))
    assert client.get(f"/api/v1/wishes/{wish['id']}").status_code == 404
    expired_select = client.post(
        f"/api/v1/wishes/{wish['id']}/select",
        headers=viewer_headers,
    )
    assert expired_select.status_code == 409


def test_blocked_users_are_excluded(client: TestClient) -> None:
    owner_session, owner_headers, _ = complete_setup(
        client,
        phone="9876500601",
        display_name="BlockOwner",
        vpa="blockowner@okhdfc",
    )
    viewer_session, viewer_headers, _ = complete_setup(
        client,
        phone="9876500602",
        display_name="BlockViewer",
        vpa="blockviewer@okaxis",
    )
    wish = _create_wish(client, owner_headers)
    _add_block(str(viewer_session["user"]["id"]), str(owner_session["user"]["id"]))

    feed = client.get("/api/v1/wishes", headers=viewer_headers)
    assert feed.status_code == 200
    assert wish["id"] not in [item["id"] for item in feed.json()["wishes"]]
    assert client.get(f"/api/v1/wishes/{wish['id']}", headers=viewer_headers).status_code == 404
    selected = client.post(
        f"/api/v1/wishes/{wish['id']}/select",
        headers=viewer_headers,
    )
    assert selected.status_code == 409

    guest_feed = client.get("/api/v1/wishes")
    assert wish["id"] in [item["id"] for item in guest_feed.json()["wishes"]]


def test_surprise_me_excludes_own_blocked_and_skipped(client: TestClient) -> None:
    viewer_session, viewer_headers, _ = complete_setup(
        client,
        phone="9876500701",
        display_name="SurpriseViewer",
        vpa="surpriseviewer@okaxis",
    )
    owner_session, owner_headers, _ = complete_setup(
        client,
        phone="9876500702",
        display_name="SurpriseOwner",
        vpa="surpriseowner@okhdfc",
    )
    wish = _create_wish(client, owner_headers)

    selected = client.post("/api/v1/wishes/surprise", headers=viewer_headers, json={})
    assert selected.status_code == 200, selected.text
    assert selected.json()["id"] == wish["id"]

    skipped = client.post(
        "/api/v1/wishes/surprise",
        headers=viewer_headers,
        json={"skippedWishIds": [wish["id"]]},
    )
    assert skipped.status_code == 404
    assert skipped.json()["code"] == "NO_ELIGIBLE_WISHES"

    _add_block(str(viewer_session["user"]["id"]), str(owner_session["user"]["id"]))
    blocked = client.post("/api/v1/wishes/surprise", headers=viewer_headers, json={})
    assert blocked.status_code == 404


def test_surprise_weights_follow_policy() -> None:
    from app.modules.discovery.service import surprise_weight

    now = datetime.now(UTC)
    assert surprise_weight(0, None, now) == 3.0
    assert surprise_weight(1, now - timedelta(days=1), now) == 0.25
    assert surprise_weight(1, now - timedelta(days=14, seconds=1), now) == 1.0
    assert surprise_weight(2, None, now) == 1.0


def test_invalid_cursor_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/wishes", params={"cursor": "not-a-cursor"})
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
