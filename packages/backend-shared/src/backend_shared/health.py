"""Liveness and database-aware readiness probes shared by every Python backend (#788).

* ``GET /healthz`` answers as long as the process serves HTTP. It never touches the database, so a
  database outage does not get the container restarted.
* ``GET /readyz`` answers 200 only when the database runs ``SELECT 1`` within
  ``READINESS_TIMEOUT_SECONDS`` and its Alembic revision equals the head revision shipped with the
  code; otherwise 503. Compose healthchecks and Caddy's active health checks probe it.

Probes run every few seconds, so their uvicorn access log lines are dropped (the Go backends log
them at DEBUG instead).
"""

import asyncio
import logging
from pathlib import Path

from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine

from backend_shared.migrations import alembic_config

logger = logging.getLogger(__name__)

LIVENESS_PATH = "/healthz"
READINESS_PATH = "/readyz"
PROBE_PATHS = frozenset({LIVENESS_PATH, READINESS_PATH})
READINESS_TIMEOUT_SECONDS = 2.0

_NO_STORE = {"Cache-Control": "no-store"}


class SchemaNotAtHeadError(RuntimeError):
    """The database's Alembic revision differs from the head revision the code ships."""


def migration_heads(backend_dir: Path) -> frozenset[str]:
    """Return the Alembic head revisions of one backend.

    Args:
        backend_dir: Backend root containing ``alembic.ini`` and the ``alembic/`` script directory.

    Returns:
        The head revision ids; a single-branch history has exactly one.
    """
    return frozenset(ScriptDirectory.from_config(alembic_config(backend_dir)).get_heads())


def _current_revisions(connection: Connection) -> frozenset[str]:
    return frozenset(MigrationContext.configure(connection).get_current_heads())


async def check_database(engine: AsyncEngine, expected_heads: frozenset[str]) -> None:
    """Verify that the database answers and its schema is at the expected Alembic heads.

    Args:
        engine: Engine of the backend's database.
        expected_heads: Head revisions the running code was built with (see ``migration_heads``).

    Raises:
        SchemaNotAtHeadError: The stored revision differs from ``expected_heads``.
        TimeoutError: The database did not answer within ``READINESS_TIMEOUT_SECONDS``.
        Exception: Any connection or query error of the driver.
    """
    async with asyncio.timeout(READINESS_TIMEOUT_SECONDS), engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
        current = await connection.run_sync(_current_revisions)
    if current != expected_heads:
        raise SchemaNotAtHeadError(f"database revision {sorted(current)} is not at head {sorted(expected_heads)}")


class ProbeAccessLogFilter(logging.Filter):
    """Drop uvicorn access log records of the health probes."""

    def filter(self, record: logging.LogRecord) -> bool:
        """Return False for an access log line of ``/healthz`` or ``/readyz``.

        Args:
            record: A ``uvicorn.access`` record; its args are (client, method, path, version, status).

        Returns:
            Whether the record is logged.
        """
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            return args[2].split("?", 1)[0] not in PROBE_PATHS
        return True


def install_probe_log_filter() -> None:
    """Attach ``ProbeAccessLogFilter`` to the uvicorn access logger once."""
    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, ProbeAccessLogFilter) for f in access_logger.filters):
        access_logger.addFilter(ProbeAccessLogFilter())


def health_router(engine: AsyncEngine, *, service: str, backend_dir: Path) -> APIRouter:
    """Build the router with the liveness and readiness probes of one backend.

    Args:
        engine: Engine of the backend's database.
        service: Service name reported in the probe responses, e.g. ``pantry-backend``.
        backend_dir: Backend root containing ``alembic.ini`` and ``alembic/``; its head revisions are
            read once here.

    Returns:
        A router to include in the FastAPI app without a prefix.
    """
    expected_heads = migration_heads(backend_dir)
    install_probe_log_filter()
    router = APIRouter(tags=["health"])

    @router.get(LIVENESS_PATH)
    async def healthz() -> JSONResponse:
        """Liveness probe: 200 while the process serves requests."""
        return JSONResponse({"status": "ok", "service": service}, headers=_NO_STORE)

    @router.get(READINESS_PATH)
    async def readyz() -> JSONResponse:
        """Readiness probe: 200 when the database answers and its schema is at head, else 503."""
        try:
            await check_database(engine, expected_heads)
        except Exception as exc:
            # The reason is logged, never returned, so the probe leaks no internals.
            logger.warning("Readiness check of %s failed: %s", service, exc)
            return JSONResponse(
                {"status": "unready", "service": service, "database": "unavailable"},
                status_code=503,
                headers=_NO_STORE,
            )
        return JSONResponse({"status": "ready", "service": service, "database": "ok"}, headers=_NO_STORE)

    return router
