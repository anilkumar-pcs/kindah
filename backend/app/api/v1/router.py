from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class MetaResponse(BaseModel):
    service: str
    version: str
    environment: str


@router.get("/meta", response_model=MetaResponse, tags=["meta"])
def get_meta(request: Request) -> MetaResponse:
    settings = request.app.state.settings
    return MetaResponse(
        service=settings.service_name,
        version=settings.version,
        environment=settings.environment,
    )
