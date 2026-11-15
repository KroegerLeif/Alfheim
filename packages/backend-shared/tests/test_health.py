"""Tests for the shared liveness and readiness probes (``backend_shared.health``)."""

import logging
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from backend_shared.health import (
    ProbeAccessLogFilter,
    SchemaNotAtHeadError,
    check_database,
    health_router,
    install_probe_log_filter,
    migration_heads,
)
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

INI = "[alembic]\nscript_location = alembic\n"
REVISION = 'revision = "{rev}"\ndown_revision = {down}\nbranch_labels = None\ndepends_on = None\n'


@pytest.fixture
def backend_dir(tmp_path: Path) -> Path:
    """A backend root with a two-revision Alembic history (head: 0002)."""
    (tmp_path / "alembic.ini").write_text(INI)
    versions = tmp_path / "alembic" / "versions"
    versions.mkdir(parents=True)
    (versions / "0001_init.py").write_text(REVISION.format(rev="0001", down="None"))
    (versions / "0002_more.py").write_text(REVISION.format(rev="0002", down='"0001"'))
    return tmp_path


@pytest_asyncio.fixture
async def engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    """An engine on an empty SQLite file database."""
    eng = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'app.db'}")
    yield eng
    await eng.dispose()


async def _stamp(engine: AsyncEngine, revision: str) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"))
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:rev)"), {"rev": revision})


def _client(engine: AsyncEngine, backend_dir: Path) -> AsyncClient:
    app = FastAPI()
    app.include_router(health_router(engine, service="test-backend", backend_dir=backend_dir))
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_migration_heads(backend_dir: Path) -> None:
    """The head of a linear history is its newest revision."""
    assert migration_heads(backend_dir) == frozenset({"0002"})


@pytest.mark.asyncio
async def test_readyz_at_head(engine: AsyncEngine, backend_dir: Path) -> None:
    """A reachable database at the head revision is ready; liveness always answers."""
    await _stamp(engine, "0002")
    async with _client(engine, backend_dir) as client:
        ready = await client.get("/readyz")
        live = await client.get("/healthz")
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready", "service": "test-backend", "database": "ok"}
    assert ready.headers["cache-control"] == "no-store"
    assert live.status_code == 200
    assert live.json() == {"status": "ok", "service": "test-backend"}


@pytest.mark.asyncio
@pytest.mark.parametrize("revision", [None, "0001"])
async def test_readyz_not_at_head(engine: AsyncEngine, backend_dir: Path, revision: str | None) -> None:
    """An unmigrated or outdated schema is not ready."""
    if revision is not None:
        await _stamp(engine, revision)
    async with _client(engine, backend_dir) as client:
        response = await client.get("/readyz")
    assert response.status_code == 503
    assert response.json()["status"] == "unready"


@pytest.mark.asyncio
async def test_readyz_database_down(tmp_path: Path, backend_dir: Path, caplog: pytest.LogCaptureFixture) -> None:
    """An unreachable database answers 503, logs the reason and does not leak it; liveness stays 200."""
    unreachable = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'missing' / 'app.db'}")
    try:
        with caplog.at_level(logging.WARNING, logger="backend_shared.health"):
            async with _client(unreachable, backend_dir) as client:
                ready = await client.get("/readyz")
                live = await client.get("/healthz")
    finally:
        await unreachable.dispose()
    assert ready.status_code == 503
    assert ready.json() == {"status": "unready", "service": "test-backend", "database": "unavailable"}
    assert "unable to open database" in caplog.text
    assert live.status_code == 200


@pytest.mark.asyncio
async def test_check_database_raises_for_wrong_revision(engine: AsyncEngine) -> None:
    """``check_database`` names the mismatch."""
    await _stamp(engine, "0001")
    with pytest.raises(SchemaNotAtHeadError, match="0001"):
        await check_database(engine, frozenset({"0002"}))


def _access_record(path: object) -> logging.LogRecord:
    return logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        1,
        '%s - "%s %s HTTP/%s" %d',
        ("1.2.3.4", "GET", path, "1.1", 200),
        None,
    )


def test_probe_access_log_filter() -> None:
    """Probe lines are dropped, everything else is kept."""
    probe_filter = ProbeAccessLogFilter()
    assert not probe_filter.filter(_access_record("/healthz"))
    assert not probe_filter.filter(_access_record("/readyz?verbose=1"))
    assert probe_filter.filter(_access_record("/api/v1/items"))
    assert probe_filter.filter(_access_record(None))
    assert probe_filter.filter(logging.LogRecord("x", logging.INFO, __file__, 1, "plain", None, None))


def test_install_probe_log_filter_is_idempotent() -> None:
    """Building several routers attaches the filter once."""
    install_probe_log_filter()
    install_probe_log_filter()
    filters = [f for f in logging.getLogger("uvicorn.access").filters if isinstance(f, ProbeAccessLogFilter)]
    assert len(filters) == 1
