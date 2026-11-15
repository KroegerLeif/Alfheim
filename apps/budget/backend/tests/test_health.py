"""Liveness and database-aware readiness probes of the budget-backend (#788)."""

import httpx
import pytest
from backend_shared import health
from src.main import app


async def _reachable(*_args: object) -> None:
    return None


async def _down(*_args: object) -> None:
    raise ConnectionRefusedError("database down")


@pytest.mark.asyncio
async def test_probes_follow_the_database(monkeypatch: pytest.MonkeyPatch) -> None:
    """/healthz ignores the database; /readyz is 200 when it answers at head and 503 while it is down."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        monkeypatch.setattr(health, "check_database", _reachable)
        ready = await client.get("/readyz")
        assert ready.status_code == 200
        assert ready.json() == {"status": "ready", "service": "budget-backend", "database": "ok"}

        monkeypatch.setattr(health, "check_database", _down)
        unready = await client.get("/readyz")
        assert unready.status_code == 503
        assert unready.json()["status"] == "unready"

        live = await client.get("/healthz")
        assert live.status_code == 200
        assert live.json() == {"status": "ok", "service": "budget-backend"}


@pytest.mark.asyncio
async def test_legacy_health_paths_are_gone() -> None:
    """The per-app health paths were replaced by /healthz and /readyz."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/health", "/api/v1/health"):
            assert (await client.get(path)).status_code == 404
