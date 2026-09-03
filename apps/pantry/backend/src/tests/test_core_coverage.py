from unittest.mock import MagicMock, patch

from fastapi import Request
from httpx import AsyncClient
from src.core.config import Settings
from src.core.dependencies import (
    decode_keycloak_token,
    get_jwks_client,
    is_mock_auth_allowed,
)
from src.main import value_error_exception_handler


def test_settings_properties():
    """Verify Settings property accessors for Keycloak URLs."""
    s = Settings(KEYCLOAK_JWKS_URL="http://custom/certs")
    assert s.jwks_url == "http://custom/certs"

    s2 = Settings(
        KEYCLOAK_URL="http://keycloak:8080/auth/",
        KEYCLOAK_PUBLIC_URL="http://public.auth/realm/",
        KEYCLOAK_REALM="alfheim",
        KEYCLOAK_JWKS_URL="",
    )
    assert s2.jwks_url == "http://keycloak:8080/auth/realms/alfheim/protocol/openid-connect/certs"
    assert s2.expected_issuer == "http://public.auth/realm/realms/alfheim"
    assert len(s2.jwks_fallback_urls) > 0


def test_core_dependency_wrappers():
    """Verify backend_shared dependency helper pass-throughs."""
    assert isinstance(is_mock_auth_allowed(), bool)
    with patch("backend_shared.dependencies.get_jwks_client") as mock_get_client:
        get_jwks_client("http://mock/jwks")
        mock_get_client.assert_called_once_with("http://mock/jwks")

    with patch("backend_shared.dependencies.decode_keycloak_token") as mock_decode:
        mock_decode.return_value = {"sub": "user-123"}
        payload = decode_keycloak_token("mock-token")
        assert payload["sub"] == "user-123"


async def test_value_error_handler():
    """Verify value_error_exception_handler converts ValueError to 400."""
    req = MagicMock(spec=Request)
    res = await value_error_exception_handler(req, ValueError("Invalid value parameter"))
    assert res.status_code == 400
    assert b"Invalid value parameter" in res.body


async def test_health_check_endpoint(client: AsyncClient):
    """Verify health check endpoint returns 200."""
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
