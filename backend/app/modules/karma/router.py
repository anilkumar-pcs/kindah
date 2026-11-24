from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.identity.dependencies import get_current_auth
from app.modules.identity.service import AuthContext
from app.modules.karma.schemas import KarmaSummaryResponse
from app.modules.karma.service import KarmaService

router = APIRouter(tags=["karma"])


@router.get("/me/karma", response_model=KarmaSummaryResponse)
def get_my_karma(
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_db_session),
) -> KarmaSummaryResponse:
    return KarmaService(session).summary(auth.user.id)
