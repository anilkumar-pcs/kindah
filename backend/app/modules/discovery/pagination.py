from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.core.errors import AppError

_HEX_RE = re.compile(r"^[0-9a-f]{32}$")
_SEED_RE = re.compile(r"^[A-Za-z0-9_-]{4,32}$")


@dataclass(frozen=True)
class FreshCursor:
    created_at: datetime
    wish_id: UUID


@dataclass(frozen=True)
class RandomCursor:
    hash_value: str
    wish_id: UUID
    seed: str


def _encode(payload: dict[str, str]) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode(value: str) -> dict[str, str]:
    try:
        padded = value + "=" * (-len(value) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise _invalid_cursor() from exc
    if not isinstance(payload, dict):
        raise _invalid_cursor()
    return {str(key): str(item) for key, item in payload.items()}


def encode_fresh_cursor(created_at: datetime, wish_id: UUID) -> str:
    return _encode({"s": "fresh", "t": created_at.isoformat(), "i": str(wish_id)})


def decode_fresh_cursor(value: str) -> FreshCursor:
    payload = _decode(value)
    try:
        if payload.get("s") != "fresh":
            raise ValueError("wrong cursor sort")
        created_at = datetime.fromisoformat(payload["t"])
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)
        return FreshCursor(created_at=created_at, wish_id=UUID(payload["i"]))
    except (KeyError, ValueError) as exc:
        raise _invalid_cursor() from exc


def encode_random_cursor(hash_value: str, wish_id: UUID, seed: str) -> str:
    return _encode({"s": "random", "h": hash_value, "i": str(wish_id), "d": seed})


def decode_random_cursor(value: str) -> RandomCursor:
    payload = _decode(value)
    try:
        if payload.get("s") != "random":
            raise ValueError("wrong cursor sort")
        hash_value = payload["h"]
        seed = payload["d"]
        if not _HEX_RE.fullmatch(hash_value) or not _SEED_RE.fullmatch(seed):
            raise ValueError("invalid cursor values")
        return RandomCursor(
            hash_value=hash_value,
            wish_id=UUID(payload["i"]),
            seed=seed,
        )
    except (KeyError, ValueError) as exc:
        raise _invalid_cursor() from exc


def _invalid_cursor() -> AppError:
    return AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid cursor",
        "The pagination cursor is invalid or does not match the requested order.",
    )
