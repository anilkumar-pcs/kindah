from __future__ import annotations

import logging
from collections.abc import Mapping
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_request_id

logger = logging.getLogger("kindly.errors")

PROBLEM_TYPE_BASE = "https://kindly.local/problems"

_STATUS_CODE_MAP: dict[int, tuple[str, str]] = {
    400: ("BAD_REQUEST", "Bad request"),
    401: ("AUTH_REQUIRED", "Authentication required"),
    403: ("FORBIDDEN", "Forbidden"),
    404: ("NOT_FOUND", "Not found"),
    405: ("METHOD_NOT_ALLOWED", "Method not allowed"),
    409: ("CONFLICT", "Conflict"),
    422: ("VALIDATION_ERROR", "Validation error"),
    429: ("RATE_LIMITED", "Rate limited"),
    503: ("DEPENDENCY_UNAVAILABLE", "Service unavailable"),
}


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        title: str,
        detail: str | None = None,
        *,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(detail or title)
        self.status_code = status_code
        self.code = code
        self.title = title
        self.detail = detail
        self.headers = dict(headers) if headers else None


def _problem_type(code: str) -> str:
    return f"{PROBLEM_TYPE_BASE}/{code.lower().replace('_', '-')}"


def problem_payload(
    request: Request,
    status_code: int,
    code: str,
    title: str,
    detail: str | None = None,
    *,
    extra: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    request_id = getattr(request.state, "request_id", None) or get_request_id()
    payload: dict[str, Any] = {
        "type": _problem_type(code),
        "title": title,
        "status": status_code,
        "code": code,
        "detail": detail,
    }
    if request_id:
        payload["requestId"] = request_id
    if extra:
        payload.update(extra)
    return payload


def problem_response(
    request: Request,
    status_code: int,
    code: str,
    title: str,
    detail: str | None = None,
    *,
    headers: Mapping[str, str] | None = None,
    extra: Mapping[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        media_type="application/problem+json",
        content=problem_payload(
            request,
            status_code,
            code,
            title,
            detail,
            extra=extra,
        ),
        headers=dict(headers) if headers else None,
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return problem_response(
            request,
            exc.status_code,
            exc.code,
            exc.title,
            exc.detail,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(part) for part in error.get("loc", ()) if part != "body"),
                "message": error.get("msg", "Invalid value"),
                "type": error.get("type", "validation_error"),
            }
            for error in exc.errors()
        ]
        return problem_response(
            request,
            HTTPStatus.UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            "Validation error",
            "One or more fields are invalid.",
            extra={"errors": errors},
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code, title = _STATUS_CODE_MAP.get(
            exc.status_code,
            ("HTTP_ERROR", HTTPStatus(exc.status_code).phrase),
        )
        detail = str(exc.detail) if exc.detail is not None else None
        return problem_response(
            request,
            exc.status_code,
            code,
            title,
            detail,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_exception",
            extra={"method": request.method, "path": request.url.path},
        )
        return problem_response(
            request,
            HTTPStatus.INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Internal server error",
            "An unexpected error occurred.",
        )
