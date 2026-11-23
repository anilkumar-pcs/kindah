from __future__ import annotations

import json
import logging
import re
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)

_SENSITIVE_KEY_TOKENS = (
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "cookie",
    "otp",
    "vpa",
    "upi_uri",
    "utr",
    "phone",
    "mobile",
    "api_key",
    "crypto_key",
)

_PHONE_RE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}(?!\d)")
_VPA_RE = re.compile(
    r"(?<![\w.-])([A-Za-z0-9][A-Za-z0-9._-]{1,49})@([A-Za-z][A-Za-z0-9]{1,30})(?![\w.-])"
)
_UPI_URI_RE = re.compile(r"upi://[^\s\"']+", re.IGNORECASE)
_BEARER_RE = re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/-]+=*")

_STANDARD_LOG_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "taskName",
    "message",
    "asctime",
}


def get_request_id() -> str | None:
    return request_id_ctx.get()


def redact_text(value: str) -> str:
    """Redact known sensitive value shapes from free-text log fields."""
    redacted = _UPI_URI_RE.sub("[REDACTED_UPI_URI]", value)
    redacted = _VPA_RE.sub("[REDACTED_VPA]", redacted)
    redacted = _PHONE_RE.sub("[REDACTED_PHONE]", redacted)
    redacted = _BEARER_RE.sub("Bearer [REDACTED_TOKEN]", redacted)
    return redacted


def is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(token in normalized for token in _SENSITIVE_KEY_TOKENS)


def redact_value(value: Any, key: str | None = None) -> Any:
    """Recursively redact sensitive keys and value shapes."""
    if key is not None and is_sensitive_key(key):
        return "[REDACTED]"
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, dict):
        return {str(k): redact_value(v, str(k)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_value(item) for item in value]
    if isinstance(value, BaseException):
        return redact_text(str(value))
    return value


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per log line with deny-by-default redaction."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_text(record.getMessage()),
        }
        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id

        for key, value in record.__dict__.items():
            if key in _STANDARD_LOG_ATTRS or key.startswith("_"):
                continue
            payload[key] = redact_value(value, key)

        if record.exc_info:
            payload["exception"] = redact_text(self.formatException(record.exc_info))

        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(level)

    # The request middleware emits one structured access record. Avoid a
    # second, differently-shaped uvicorn access line.
    logging.getLogger("uvicorn.access").disabled = True
    for logger_name in ("uvicorn", "uvicorn.error"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True
