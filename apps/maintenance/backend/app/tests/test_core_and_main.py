"""Unit tests for maintenance core config, database helpers, dependencies, telemetry, MCP, and main."""

from unittest.mock import MagicMock, patch

import pytest
from app.core.config import settings
from app.core.database import get_db_session, init_db
from app.core.dependencies import (
    decode_oidc_token,
    get_jwks_client,
    is_mock_auth_allowed,
)
from app.core.mcp import discover_and_import_mcp_tools
from app.main import app, lifespan
from app.tests.conftest import test_engine, test_session_factory
from backend_shared import oidc_discovery
from backend_shared.telemetry import setup_telemetry, shutdown_telemetry
from httpx import AsyncClient


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


def test_core_dependencies_wrappers():
    """Verify delegation in core dependencies wrappers."""
    with patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=True) as mock_auth:
        assert is_mock_auth_allowed() is True
        mock_auth.assert_called_once()

    with patch("backend_shared.dependencies.get_jwks_client", return_value=MagicMock()) as mock_jwks:
        res = get_jwks_client("http://test-jwks")
        assert res is not None
        mock_jwks.assert_called_once_with("http://test-jwks")

    with patch("backend_shared.dependencies.decode_oidc_token", return_value={"sub": "123"}) as mock_decode:
        decoded = decode_oidc_token("mock-token")
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
        patch("backend_shared.telemetry.shutdown_telemetry") as mock_shutdown,
    ):
        async with lifespan(app):
            pass
        mock_init.assert_called_once()
        mock_shutdown.assert_called_once()
