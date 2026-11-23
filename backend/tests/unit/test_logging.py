from __future__ import annotations

import json
import logging

from app.core.logging import JsonFormatter, is_sensitive_key, redact_text, redact_value


def test_redact_text_removes_sensitive_value_shapes() -> None:
    raw = (
        "phone +91 98765 43210 vpa alice@okhdfc "
        "uri upi://pay?pa=alice@okhdfc&am=25&cu=INR "
        "auth Bearer abc.def.ghi"
    )
    redacted = redact_text(raw)

    assert "98765" not in redacted
    assert "alice@okhdfc" not in redacted
    assert "upi://pay" not in redacted
    assert "abc.def.ghi" not in redacted
    assert "[REDACTED_PHONE]" in redacted
    assert "[REDACTED_UPI_URI]" in redacted
    assert "[REDACTED_TOKEN]" in redacted


def test_redact_value_removes_sensitive_keys_recursively() -> None:
    payload = {
        "amount": 25,
        "vpa": "alice@okhdfc",
        "nested": {"mobile": "+919876543210", "note": "plain text"},
        "items": [{"token": "secret-token"}, {"safe": 1}],
    }
    redacted = redact_value(payload)

    assert redacted["amount"] == 25
    assert redacted["vpa"] == "[REDACTED]"
    assert redacted["nested"]["mobile"] == "[REDACTED]"
    assert redacted["nested"]["note"] == "plain text"
    assert redacted["items"][0]["token"] == "[REDACTED]"
    assert redacted["items"][1]["safe"] == 1


def test_sensitive_key_detection() -> None:
    assert is_sensitive_key("refresh_token")
    assert is_sensitive_key("Authorization")
    assert is_sensitive_key("phone_number")
    assert is_sensitive_key("upi_uri")
    assert not is_sensitive_key("amount")
    assert not is_sensitive_key("status_code")


def test_json_formatter_redacts_message_and_extras() -> None:
    record = logging.Logger("test").makeRecord(
        "test",
        logging.INFO,
        __file__,
        1,
        "contact %s about %s",
        ("+919876543210", "alice@okhdfc"),
        None,
        extra={"vpa": "alice@okhdfc", "amount": 25},
    )
    output = json.loads(JsonFormatter().format(record))

    assert "98765" not in output["message"]
    assert "alice@okhdfc" not in output["message"]
    assert output["vpa"] == "[REDACTED]"
    assert output["amount"] == 25
    assert output["level"] == "INFO"
