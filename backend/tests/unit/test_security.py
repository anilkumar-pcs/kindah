from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.core.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    generate_opaque_token,
    generate_otp,
    hash_opaque_token,
    hash_otp,
    mask_mobile,
    normalize_indian_mobile,
)


def make_settings() -> Settings:
    return Settings(
        environment="test",
        jwt_secret="unit-test-jwt-secret-minimum-32-characters",
        refresh_token_pepper="unit-test-refresh-pepper-minimum-32-characters",
        crypto_key="unit-test-crypto-key-minimum-32-characters",
        lookup_hmac_key="unit-test-lookup-key-minimum-32-characters",
        otp_hmac_key="unit-test-otp-key-minimum-32-characters",
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("9876543210", "+919876543210"),
        ("+919876543210", "+919876543210"),
        ("+91 98765 43210", "+919876543210"),
        ("09876543210", "+919876543210"),
        ("919876543210", "+919876543210"),
        (" 98765-43210 ", "+919876543210"),
    ],
)
def test_normalize_indian_mobile(raw: str, expected: str) -> None:
    assert normalize_indian_mobile(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["1234567890", "98765", "+1 2025550123", "98765abcde", "5876543210", ""],
)
def test_normalize_indian_mobile_rejects_invalid(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_indian_mobile(raw)


def test_mask_mobile_keeps_only_last_four_digits() -> None:
    assert mask_mobile("+919876543210") == "+91 ******3210"
    assert "987654" not in mask_mobile("+919876543210")


def test_generated_otp_is_six_digits() -> None:
    for _ in range(50):
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()


def test_hash_otp_is_challenge_bound() -> None:
    key = "a" * 32
    first = hash_otp(key, "challenge-a", "123456")
    second = hash_otp(key, "challenge-b", "123456")
    assert first != second
    assert hash_otp(key, "challenge-a", "123456") == first


def test_opaque_token_hash_is_not_reversible_looking() -> None:
    token = generate_opaque_token()
    hashed = hash_opaque_token(token)
    assert token not in hashed
    assert len(hashed) == 64


def test_access_token_round_trip() -> None:
    settings = make_settings()
    token, expires_at = create_access_token(
        settings,
        user_id="11111111-1111-1111-1111-111111111111",
        session_id="22222222-2222-2222-2222-222222222222",
    )
    claims = decode_access_token(settings, token)
    assert claims.user_id == "11111111-1111-1111-1111-111111111111"
    assert claims.session_id == "22222222-2222-2222-2222-222222222222"
    assert claims.expires_at == expires_at.replace(microsecond=0)


def test_expired_access_token_is_rejected() -> None:
    settings = make_settings()
    token, _ = create_access_token(
        settings,
        user_id="11111111-1111-1111-1111-111111111111",
        session_id="22222222-2222-2222-2222-222222222222",
        now=datetime.now(UTC) - timedelta(hours=2),
    )
    with pytest.raises(TokenError):
        decode_access_token(settings, token)


def test_tampered_access_token_is_rejected() -> None:
    settings = make_settings()
    token, _ = create_access_token(
        settings,
        user_id="11111111-1111-1111-1111-111111111111",
        session_id="22222222-2222-2222-2222-222222222222",
    )
    with pytest.raises(TokenError):
        decode_access_token(settings, f"{token[:-1]}x")


def test_token_signed_with_another_secret_is_rejected() -> None:
    settings = make_settings()
    other = settings.model_copy(
        update={"jwt_secret": SecretStr("another-secret-key-minimum-32-characters")}
    )
    token, _ = create_access_token(
        settings,
        user_id="11111111-1111-1111-1111-111111111111",
        session_id="22222222-2222-2222-2222-222222222222",
    )
    with pytest.raises(TokenError):
        decode_access_token(other, token)
