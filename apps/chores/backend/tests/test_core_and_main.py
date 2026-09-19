"""Unit tests for chores core configurations, database helpers, dependencies, and main application entrypoint."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from backend_shared import oidc_discovery
from backend_shared.telemetry import setup_telemetry, shutdown_telemetry
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.config import settings
from src.core.database import get_db_session, init_db
from src.main import app, handle_task_exception

_test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def test_settings_jwks_url_explicit_override_wins():
    """Verify an explicit OIDC_JWKS_URL override is used without any discovery call."""
    assert settings.expected_issuer == settings.OIDC_ISSUER_URL.rstrip("/")

    with patch.object(settings, "OIDC_JWKS_URL", "http://custom-jwks:8080/keys"):
        with patch("httpx.Client") as mock_client:
            assert settings.jwks_url == "http://custom-jwks:8080/keys"
            mock_client.assert_not_called()


def test_settings_jwks_url_resolved_via_oidc_discovery():
    """Verify jwks_url is resolved from the issuer's discovery document, not guessed."""
    oidc_discovery._discovered_jwks_uris.clear()

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = {"jwks_uri": f"{settings.expected_issuer}/oauth/v2/keys"}

    with patch.object(settings, "OIDC_JWKS_URL", ""), patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get.return_value = mock_resp
        assert settings.jwks_url == f"{settings.expected_issuer}/oauth/v2/keys"

    oidc_discovery._discovered_jwks_uris.clear()


@pytest.mark.asyncio
async def test_core_database_helpers():
    """Verify get_db_session generator and init_db runner with SQLite test engine."""
    with patch("src.core.database.async_session_factory", _test_session_factory):
        async for session in get_db_session():
            assert session is not None
            break

    with patch("src.core.database.engine", _test_engine):
        await init_db()


def test_telemetry_setup_and_shutdown():
    """Verify setup_telemetry and shutdown_telemetry hooks."""
    with patch.object(settings, "OTEL_ENABLED", True):
        setup_telemetry(app)
    shutdown_telemetry()


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    """Verify the /api/v1/health status endpoint."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "project" in response.json()


def test_handle_task_exception_callback():
    """Verify background task error handling and logging callback."""
    # Normal cancelled task
    task_cancelled = MagicMock(spec=asyncio.Task)
    task_cancelled.cancelled.return_value = True
    handle_task_exception(task_cancelled)

    # Task with exception
    task_err = MagicMock(spec=asyncio.Task)
    task_err.cancelled.return_value = False
    task_err.exception.return_value = RuntimeError("Test background crash")
    task_err.get_name.return_value = "reset_task"
    handle_task_exception(task_err)


@pytest.mark.asyncio
async def test_schedule_nightly_reset_success_and_cancel():
    """Verify schedule_nightly_reset background runner loop execution and clean cancellation."""
    from src.main import schedule_nightly_reset

    sleep_calls = 0

    async def mock_sleep(sec):
        nonlocal sleep_calls
        sleep_calls += 1
        if sleep_calls == 1:
            return  # Let first iteration run
        raise asyncio.CancelledError()

    with (
        patch("asyncio.sleep", side_effect=mock_sleep),
        patch("src.features.chore_management.service.ChoreService.run_nightly_reset_for_all", new_callable=AsyncMock),
        patch("src.core.database.async_session_factory", _test_session_factory),
    ):
        await schedule_nightly_reset()
        assert sleep_calls >= 1


@pytest.mark.asyncio
async def test_schedule_nightly_reset_exception_retry():
    """Verify schedule_nightly_reset exception logging and retry sleep behavior."""
    from src.main import schedule_nightly_reset

    sleep_calls = 0

    async def mock_sleep(sec):
        nonlocal sleep_calls
        sleep_calls += 1
        if sleep_calls <= 2:
            return
        raise asyncio.CancelledError()

    with (
        patch("asyncio.sleep", side_effect=mock_sleep),
        patch(
            "src.features.chore_management.service.ChoreService.run_nightly_reset_for_all",
            side_effect=RuntimeError("Transient DB error"),
        ),
        patch("src.core.database.async_session_factory", _test_session_factory),
    ):
        await schedule_nightly_reset()
        assert sleep_calls >= 2


def test_discover_and_include_routers_edge_cases():
    """Verify discover_and_include_routers handling of missing directory or import failures."""
    from fastapi import FastAPI
    from src.main import discover_and_include_routers

    dummy_app = FastAPI()

    # When features directory does not exist
    with patch("pathlib.Path.exists", return_value=False):
        discover_and_include_routers(dummy_app)

    # When importlib fails to import router module
    with patch("importlib.import_module", side_effect=ImportError("Failed module import")):
        discover_and_include_routers(dummy_app)
