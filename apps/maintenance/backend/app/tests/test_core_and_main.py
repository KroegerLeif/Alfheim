"""Unit tests for maintenance core config, database helpers, dependencies, telemetry, MCP, and main."""

from unittest.mock import MagicMock, patch

import pytest
from app.core.config import settings
from app.core.database import LegacyHouseholdSchemaError, _python_type, get_db_session, init_db
from app.core.dependencies import get_authorization
from app.core.mcp import discover_and_import_mcp_tools
from app.main import app, lifespan
from app.tests.conftest import test_engine, test_session_factory
from backend_shared import oidc_discovery
from backend_shared.telemetry import setup_telemetry, shutdown_telemetry
from fastapi import Request
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.types import NullType


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


def test_get_authorization_returns_caller_header():
    """get_authorization exposes the caller's bearer token for downstream service calls."""
    request = Request({"type": "http", "headers": [(b"authorization", b"Bearer abc")]})
    assert get_authorization(request) == "Bearer abc"
    assert get_authorization(Request({"type": "http", "headers": []})) is None


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
        patch("app.main.close_membership_client") as mock_close,
    ):
        async with lifespan(app):
            pass
        mock_init.assert_called_once()
        mock_shutdown.assert_called_once()
        mock_close.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "legacy_ddl",
    [
        ["CREATE TABLE household (id INTEGER PRIMARY KEY, name VARCHAR)"],
        ["CREATE TABLE device (id INTEGER PRIMARY KEY, household_id INTEGER)"],
    ],
)
async def test_init_db_refuses_legacy_integer_household_schema(legacy_ddl: list[str]):
    """init_db fails fast (with reset instructions) on the pre-UUID schema instead of serving broken queries."""
    legacy_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with legacy_engine.begin() as conn:
        for ddl in legacy_ddl:
            await conn.execute(text(ddl))
    with patch("app.core.database.engine", legacy_engine):
        with pytest.raises(LegacyHouseholdSchemaError, match="Data reset required"):
            await init_db()
    await legacy_engine.dispose()


@pytest.mark.asyncio
async def test_init_db_accepts_uuid_schema():
    """A database already on the UUID schema (or empty) initializes normally and stays idempotent."""
    fresh_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    with patch("app.core.database.engine", fresh_engine):
        await init_db()
        await init_db()
    await fresh_engine.dispose()


def test_python_type_of_unknown_column_type():
    assert _python_type(NullType()) is None
