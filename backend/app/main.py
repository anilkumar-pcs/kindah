from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.api.v1.router import router as api_v1_router
from app.core.config import Settings, get_settings
from app.core.db import Database
from app.core.errors import problem_response, register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.core.redis import RedisHealth

logger = logging.getLogger("kindly.app")


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    configure_logging(resolved_settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield
        redis_health: RedisHealth | None = app.state.redis_health
        if redis_health is not None:
            await redis_health.close()
        app.state.db.dispose()

    app = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.version,
        docs_url=resolved_settings.docs_url,
        redoc_url=resolved_settings.redoc_url,
        openapi_url=None if resolved_settings.is_production else "/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.state.db = Database(
        resolved_settings.database_url,
        resolved_settings.db_connect_timeout_seconds,
    )
    app.state.redis_health = (
        RedisHealth(
            resolved_settings.redis_url,
            resolved_settings.redis_timeout_seconds,
        )
        if resolved_settings.redis_url
        else None
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-Request-ID",
        ],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(SecurityHeadersMiddleware, settings=resolved_settings)

    register_exception_handlers(app)
    app.include_router(api_v1_router, prefix=resolved_settings.api_v1_prefix)

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict[str, str]:
        return {
            "status": "ok",
            "service": resolved_settings.service_name,
            "version": resolved_settings.version,
        }

    @app.get("/readyz", include_in_schema=False)
    async def readyz(request: Request) -> JSONResponse:
        database_ok = True
        try:
            await run_in_threadpool(app.state.db.check)
        except Exception:
            database_ok = False
            logger.warning("database_readiness_failed")

        redis_status = "disabled"
        redis_health: RedisHealth | None = app.state.redis_health
        if redis_health is not None:
            redis_ok = await redis_health.check()
            redis_status = "ok" if redis_ok else "degraded"
            if not redis_ok:
                logger.warning("redis_readiness_degraded")

        checks = {
            "database": "ok" if database_ok else "unavailable",
            "redis": redis_status,
        }
        if not database_ok:
            return problem_response(
                request,
                503,
                "DEPENDENCY_UNAVAILABLE",
                "Service unavailable",
                "The database is unavailable.",
                extra={"checks": checks},
            )

        status = "ok" if redis_status in {"ok", "disabled"} else "degraded"
        return JSONResponse(status_code=200, content={"status": status, "checks": checks})

    return app


app = create_app()
