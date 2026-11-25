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
_FORBIDDEN_PUBLIC_FIELDS = {
    "phone",
    "mobile",
    "vpa",
    "maskedVpa",
    "userId",
    "utr",
    "paymentRef",
}


def _create_user(
    client: TestClient,
    suffix: int,
    display_name: str,
) -> tuple[dict[str, Any], dict[str, str], dict[str, Any]]:
    return complete_setup(
        client,
        phone=f"9876510{suffix:03d}",
        display_name=display_name,
        vpa=f"filter{suffix}@okhdfc",
    )


def _create_wish(
    client: TestClient,
    headers: dict[str, str],
    *,
    message: str = _VALID_MESSAGE,
    mood: str = "LONG_DAY",
    amount: int | None = 25,
    city: str = "Bengaluru",
) -> dict[str, Any]:
    payload: dict[str, Any] = {"message": message, "mood": mood, "city": city}
    if amount is not None:
        payload["suggestedAmountInr"] = amount
    response = client.post("/api/v1/wishes", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


def _insert_wish(
    *,
    user_id: str,
    message: str,
    status: WishStatus,
    city: str = "Bengaluru",
) -> UUID:
    now = datetime.now(UTC)
    wish_id = uuid.uuid4()
    wish = Wish(
        id=wish_id,
        user_id=UUID(user_id),
        message=message,
        mood=WishMood.JUST_BECAUSE,
        city=city,
        status=status,
        expires_at=now + timedelta(hours=24),
        created_at=now - timedelta(minutes=5),
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


def _add_blocks(first_id: str, second_id: str) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            db.add(
                UserBlock(
                    blocker_id=UUID(first_id),
                    blocked_id=UUID(second_id),
                )
            )
            db.add(
                UserBlock(
                    blocker_id=UUID(second_id),
                    blocked_id=UUID(first_id),
                )
            )
            db.commit()
    finally:
        engine.dispose()


def _ids(body: dict[str, Any]) -> set[str]:
    return {wish["id"] for wish in body["wishes"]}


def test_search_matches_message_and_display_pseudonym_only(client: TestClient) -> None:
    _, headers_one, _ = _create_user(client, 1, "ChaiFriend")
    message_match = _create_wish(
        client,
        headers_one,
        message="A warm bowl of soup helps tonight",
    )
    _, headers_two, _ = _create_user(client, 2, "SoupLover")
    pseudonym_match = _create_wish(
        client,
        headers_two,
        message="A quiet book for a calm evening",
    )
    _, headers_three, _ = _create_user(client, 3, "BookWorm")
    city_match = _create_wish(
        client,
        headers_three,
        message="A soft blanket for the winter",
        city="Souptown",
    )

    response = client.get("/api/v1/wishes", params={"q": "  SOUP  "})

    assert response.status_code == 200, response.text
    body = response.json()
    assert _ids(body) == {message_match["id"], pseudonym_match["id"]}
    assert body["totalCount"] == 2
    assert city_match["id"] not in _ids(body)
    for card in body["wishes"]:
        assert _FORBIDDEN_PUBLIC_FIELDS.isdisjoint(card)

    literal = client.get("/api/v1/wishes", params={"q": "%"})
    assert literal.status_code == 200
    assert literal.json()["wishes"] == []
    assert literal.json()["totalCount"] == 0

    blank = client.get("/api/v1/wishes", params={"q": "   "})
    assert blank.status_code == 200
    assert blank.json()["totalCount"] == 3


def test_mood_filter_and_invalid_mood(client: TestClient) -> None:
    _, headers_one, _ = _create_user(client, 10, "ChaiSnackUser")
    snack = _create_wish(client, headers_one, mood="CHAI_SNACK")
    _, headers_two, _ = _create_user(client, 11, "TinyTreatUser")
    treat = _create_wish(client, headers_two, mood="TINY_TREAT")

    response = client.get("/api/v1/wishes", params={"mood": "CHAI_SNACK"})

    assert response.status_code == 200, response.text
    assert _ids(response.json()) == {snack["id"]}
    assert response.json()["totalCount"] == 1
    assert treat["id"] not in _ids(response.json())

    invalid = client.get("/api/v1/wishes", params={"mood": "ANGRY"})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "VALIDATION_ERROR"


def test_amount_filters_exclude_wishes_without_suggested_amount(
    client: TestClient,
) -> None:
    amounts = [10, 25, None, 100]
    wishes = []
    for index, amount in enumerate(amounts, start=20):
        _, headers, _ = _create_user(client, index, f"AmountUser{index}")
        wishes.append(_create_wish(client, headers, amount=amount))

    low = client.get("/api/v1/wishes", params={"amount_max": 24})
    assert low.status_code == 200, low.text
    assert _ids(low.json()) == {wishes[0]["id"]}
    assert low.json()["totalCount"] == 1

    band = client.get(
        "/api/v1/wishes",
        params={"amount_min": 20, "amount_max": 50},
    )
    assert band.status_code == 200, band.text
    assert _ids(band.json()) == {wishes[1]["id"]}

    high = client.get("/api/v1/wishes", params={"amount_min": 26})
    assert high.status_code == 200, high.text
    assert _ids(high.json()) == {wishes[3]["id"]}

    full_range = client.get(
        "/api/v1/wishes",
        params={"amount_min": 10, "amount_max": 100},
    )
    assert full_range.status_code == 200, full_range.text
    assert _ids(full_range.json()) == {wishes[0]["id"], wishes[1]["id"], wishes[3]["id"]}
    assert wishes[2]["id"] not in _ids(full_range.json())


@pytest.mark.parametrize(
    "params",
    [
        {"amount_min": 9},
        {"amount_max": 101},
        {"amount_min": 50, "amount_max": 20},
        {"amount_min": "abc"},
        {"q": "x" * 81},
    ],
)
def test_invalid_search_and_amount_filters_are_rejected(
    client: TestClient,
    params: dict[str, object],
) -> None:
    response = client.get("/api/v1/wishes", params=params)

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_combined_search_mood_and_amount_filters(client: TestClient) -> None:
    _, headers_one, _ = _create_user(client, 30, "MorningChai")
    matching = _create_wish(
        client,
        headers_one,
        message="A chai for the rainy morning",
        mood="LONG_DAY",
        amount=25,
    )
    _, headers_two, _ = _create_user(client, 31, "NightTea")
    _create_wish(
        client,
        headers_two,
        message="A chai for the quiet night",
        mood="CHAI_SNACK",
        amount=25,
    )
    _, headers_three, _ = _create_user(client, 32, "ChaiReader")
    _create_wish(
        client,
        headers_three,
        message="A book for the afternoon",
        mood="CHAI_SNACK",
        amount=25,
    )
    _, headers_four, _ = _create_user(client, 33, "ChaiSaver")
    _create_wish(
        client,
        headers_four,
        message="A warm chai in a big cup",
        mood="LONG_DAY",
        amount=60,
    )

    response = client.get(
        "/api/v1/wishes",
        params={
            "q": "chai",
            "mood": "LONG_DAY",
            "amount_min": 20,
            "amount_max": 30,
        },
    )

    assert response.status_code == 200, response.text
    assert _ids(response.json()) == {matching["id"]}
    assert response.json()["totalCount"] == 1


def test_cursor_paginates_and_is_bound_to_active_filters(client: TestClient) -> None:
    created = []
    for index in range(1, 6):
        _, headers, _ = _create_user(client, 40 + index, f"CursorUser{index}")
        created.append(
            _create_wish(
                client,
                headers,
                message=f"A chai for pause number {index}",
                mood="LONG_DAY",
                amount=25,
            )
        )
    _, headers_extra, _ = _create_user(client, 50, "ExtraWish")
    _create_wish(
        client,
        headers_extra,
        message="A chai that costs a little more",
        mood="LONG_DAY",
        amount=60,
    )

    filters = {
        "q": "chai",
        "mood": "LONG_DAY",
        "amount_min": 10,
        "amount_max": 30,
    }
    first = client.get(
        "/api/v1/wishes",
        params={**filters, "limit": 3},
    )
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert len(first_body["wishes"]) == 3
    assert first_body["totalCount"] == 5
    assert first_body["nextCursor"]

    second = client.get(
        "/api/v1/wishes",
        params={**filters, "limit": 3, "cursor": first_body["nextCursor"]},
    )
    assert second.status_code == 200, second.text
    second_body = second.json()
    assert len(second_body["wishes"]) == 2
    assert second_body["totalCount"] == 5
    assert second_body["nextCursor"] is None
    assert _ids(first_body) | _ids(second_body) == {wish["id"] for wish in created}
    assert not (_ids(first_body) & _ids(second_body))

    changed_filter = client.get(
        "/api/v1/wishes",
        params={
            **filters,
            "amount_max": 40,
            "limit": 3,
            "cursor": first_body["nextCursor"],
        },
    )
    assert changed_filter.status_code == 400
    assert changed_filter.json()["code"] == "VALIDATION_ERROR"

    changed_search = client.get(
        "/api/v1/wishes",
        params={
            **filters,
            "q": "tea",
            "limit": 3,
            "cursor": first_body["nextCursor"],
        },
    )
    assert changed_search.status_code == 400
    assert changed_search.json()["code"] == "VALIDATION_ERROR"


def test_random_cursor_remains_valid_with_filters(client: TestClient) -> None:
    for index in range(1, 4):
        _, headers, _ = _create_user(client, 60 + index, f"RandomFilterUser{index}")
        _create_wish(
            client,
            headers,
            message=f"A chai for random order number {index}",
            mood="LONG_DAY",
            amount=25,
        )

    filters = {
        "q": "chai",
        "mood": "LONG_DAY",
        "sort": "random",
        "seed": "filterseed",
        "limit": 2,
    }
    first = client.get("/api/v1/wishes", params=filters)
    assert first.status_code == 200, first.text
    assert first.json()["totalCount"] == 3
    assert first.json()["nextCursor"]

    second = client.get(
        "/api/v1/wishes",
        params={**filters, "cursor": first.json()["nextCursor"]},
    )
    assert second.status_code == 200, second.text
    assert len(second.json()["wishes"]) == 1

    changed = client.get(
        "/api/v1/wishes",
        params={
            **filters,
            "q": "tea",
            "cursor": first.json()["nextCursor"],
        },
    )
    assert changed.status_code == 400
    assert changed.json()["code"] == "VALIDATION_ERROR"


def test_filters_preserve_own_blocked_and_state_exclusions(client: TestClient) -> None:
    viewer_session, viewer_headers, _ = _create_user(client, 70, "FilterViewer")
    own_wish = _create_wish(
        client,
        viewer_headers,
        message="A kindness wish for me only",
    )

    _owner_session, owner_headers, _ = _create_user(client, 71, "KindOwner")
    eligible = _create_wish(
        client,
        owner_headers,
        message="A kindness wish for everyone",
    )

    blocked_session, blocked_headers, _ = _create_user(client, 72, "BlockedOwner")
    blocked = _create_wish(
        client,
        blocked_headers,
        message="A kindness wish from a blocked owner",
    )
    _add_blocks(
        str(viewer_session["user"]["id"]),
        str(blocked_session["user"]["id"]),
    )

    excluded_session, _excluded_headers, _ = _create_user(client, 73, "ExcludedOwner")
    _insert_wish(
        user_id=str(excluded_session["user"]["id"]),
        message="A kindness wish that has expired",
        status=WishStatus.EXPIRED,
    )
    _insert_wish(
        user_id=str(excluded_session["user"]["id"]),
        message="A kindness wish under review",
        status=WishStatus.UNDER_REVIEW,
    )
    _insert_wish(
        user_id=str(excluded_session["user"]["id"]),
        message="A kindness wish that was removed",
        status=WishStatus.REMOVED,
    )

    for_viewer = client.get(
        "/api/v1/wishes",
        headers=viewer_headers,
        params={"q": "kindness"},
    )
    assert for_viewer.status_code == 200, for_viewer.text
    assert _ids(for_viewer.json()) == {eligible["id"]}
    assert for_viewer.json()["totalCount"] == 1
    for card in for_viewer.json()["wishes"]:
        assert _FORBIDDEN_PUBLIC_FIELDS.isdisjoint(card)

    for_guest = client.get("/api/v1/wishes", params={"q": "kindness"})
    assert for_guest.status_code == 200, for_guest.text
    assert _ids(for_guest.json()) == {own_wish["id"], eligible["id"], blocked["id"]}
    assert for_guest.json()["totalCount"] == 3
