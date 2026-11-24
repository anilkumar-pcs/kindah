from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.modules.discovery.router import router as discovery_router
from app.modules.identity.router import router as identity_router
from app.modules.payment_methods.router import router as payment_methods_router
from app.modules.wishes.router import router as wishes_router

router = APIRouter()
router.include_router(identity_router)
router.include_router(payment_methods_router)
router.include_router(wishes_router)
router.include_router(discovery_router)


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
