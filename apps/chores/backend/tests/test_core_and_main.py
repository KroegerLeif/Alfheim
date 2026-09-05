"""Unit tests for chores core configurations, database helpers, dependencies, and main application entrypoint."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.config import settings
from src.core.database import get_db_session, init_db
from src.core.dependencies import (
    decode_keycloak_token,
    get_jwks_client,
    is_mock_auth_allowed,
)
from src.core.telemetry import setup_telemetry, shutdown_telemetry
from src.main import app, handle_task_exception

_test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def test_settings_properties():
    """Verify JWKS URLs and issuer configurations computed properties."""
    assert "protocol/openid-connect/certs" in settings.jwks_url
    assert "realms/alfheim" in settings.expected_issuer

    fallback_urls = settings.jwks_fallback_urls
    assert len(fallback_urls) >= 1
    assert any("localhost" in u for u in fallback_urls)

    # With explicit JWKS URL override
    with patch.object(settings, "KEYCLOAK_JWKS_URL", "http://custom-jwks:8080/certs"):
        assert settings.jwks_url == "http://custom-jwks:8080/certs"


def test_core_dependencies_wrappers():
    """Verify delegation in core dependencies wrappers."""
    with patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=True) as mock_auth:
        assert is_mock_auth_allowed() is True
        mock_auth.assert_called_once()

    with patch("backend_shared.dependencies.get_jwks_client", return_value=MagicMock()) as mock_jwks:
        res = get_jwks_client("http://test-jwks")
        assert res is not None
        mock_jwks.assert_called_once_with("http://test-jwks")

    with patch("backend_shared.dependencies.decode_keycloak_token", return_value={"sub": "123"}) as mock_decode:
        decoded = decode_keycloak_token("mock-token")
        assert decoded["sub"] == "123"
        mock_decode.assert_called_once_with("mock-token", settings=settings)


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
