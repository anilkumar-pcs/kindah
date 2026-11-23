from __future__ import annotations

from typing import Any

from redis.asyncio import Redis


class RedisHealth:
    """Optional Redis connectivity probe.

    Redis is intentionally not used for domain state or correctness. A missing
    or unreachable Redis must never take the API down in Phase 1.
    """

    def __init__(self, url: str, timeout_seconds: float = 1.0) -> None:
        self._client: Redis = Redis.from_url(
            url,
            socket_connect_timeout=timeout_seconds,
            socket_timeout=timeout_seconds,
            decode_responses=True,
        )

    async def check(self) -> bool:
        try:
            result: Any = await self._client.ping()
            return bool(result)
        except Exception:
            return False

    async def close(self) -> None:
        await self._client.aclose()
