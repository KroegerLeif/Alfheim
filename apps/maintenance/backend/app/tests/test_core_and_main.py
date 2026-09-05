"""Unit tests for maintenance core config, database helpers, dependencies, telemetry, MCP, and main."""

from unittest.mock import MagicMock, patch

import pytest
from app.core.config import settings
from app.core.database import get_db_session, init_db
from app.core.dependencies import (
    decode_keycloak_token,
    get_jwks_client,
    is_mock_auth_allowed,
)
from app.core.mcp import discover_and_import_mcp_tools
from app.core.telemetry import setup_telemetry, shutdown_telemetry
from app.main import app, lifespan
from app.tests.conftest import test_engine, test_session_factory
from httpx import AsyncClient


def test_settings_properties():
    """Verify JWKS URLs and issuer configurations computed properties."""
    assert "protocol/openid-connect/certs" in settings.jwks_url
    assert "realms/alfheim" in settings.expected_issuer

    fallback_urls = settings.jwks_fallback_urls
    assert len(fallback_urls) >= 1
    assert any("localhost" in u for u in fallback_urls)

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
    with patch("app.core.database.async_session_factory", test_session_factory):
        async for session in get_db_session():
            assert session is not None
            break

    with patch("app.core.database.engine", test_engine):
        await init_db()


def test_telemetry_setup_and_shutdown():
    """Verify setup_telemetry and shutdown_telemetry hooks."""
    with patch.object(settings, "OTEL_ENABLED", True):
        setup_telemetry(app)
    shutdown_telemetry()


def test_discover_and_import_mcp_tools_error_handling():
    """Verify error logging when an MCP tool module fails to import."""
    with patch("importlib.import_module", side_effect=ImportError("MCP tool import fail")):
        discover_and_import_mcp_tools()


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    """Verify the /api/v1/health status endpoint."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "project" in response.json()


@pytest.mark.asyncio
async def test_application_lifespan():
    """Verify application lifespan setup and shutdown."""
    with (
        patch("app.core.database.init_db") as mock_init,
        patch("app.core.telemetry.shutdown_telemetry") as mock_shutdown,
    ):
        async with lifespan(app):
            pass
        mock_init.assert_called_once()
        mock_shutdown.assert_called_once()
