from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.modules.identity.models import AuthEvent


def record_audit_event(
    *,
    session: Session,
    event_type: str,
    user_id: uuid.UUID | None,
    request_ip_hmac: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuthEvent(
            user_id=user_id,
            event_type=event_type,
            request_ip_hmac=request_ip_hmac,
            event_metadata=metadata or {},
        )
    )
