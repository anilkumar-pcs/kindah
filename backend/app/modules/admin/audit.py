from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.logging import get_request_id
from app.modules.admin.models import AdminAuditLog
from app.providers.crypto.base import CryptoProvider


def record_admin_audit(
    *,
    session: Session,
    crypto: CryptoProvider,
    actor_id: UUID,
    action: str,
    target_type: str,
    target_id: UUID | None,
    reason: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AdminAuditLog:
    entry = AdminAuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason_encrypted=(crypto.encrypt(reason, context="admin.audit.reason") if reason else None),
        request_id=get_request_id(),
        event_metadata=metadata or {},
    )
    session.add(entry)
    return entry
