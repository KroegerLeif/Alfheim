from unittest.mock import MagicMock, patch

from backend_shared import oidc_discovery
from fastapi import Request
from httpx import AsyncClient
from src.core.config import Settings
from src.core.dependencies import (
    decode_oidc_token,
    get_jwks_client,
    is_mock_auth_allowed,
)
from src.main import value_error_exception_handler


def test_settings_jwks_url_explicit_override_wins():
    """Verify an explicit OIDC_JWKS_URL override is used without any discovery call."""
    s = Settings(OIDC_JWKS_URL="http://custom/certs")
    with patch("httpx.Client") as mock_client:
        assert s.jwks_url == "http://custom/certs"
        mock_client.assert_not_called()


def test_settings_jwks_url_resolved_via_oidc_discovery():
    """Verify jwks_url is resolved from the issuer's discovery document, not guessed."""
    oidc_discovery._discovered_jwks_uris.clear()
    s2 = Settings(
        OIDC_ISSUER_URL="http://api.alfheim.loegien.localhost/auth/",
        OIDC_AUDIENCE="alfheim",
        OIDC_JWKS_URL="",
    )

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = {"jwks_uri": "http://api.alfheim.loegien.localhost/auth/oauth/v2/keys"}

    with patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get.return_value = mock_resp
        assert s2.jwks_url == "http://api.alfheim.loegien.localhost/auth/oauth/v2/keys"

    assert s2.expected_issuer == "http://api.alfheim.loegien.localhost/auth"
    oidc_discovery._discovered_jwks_uris.clear()


def test_core_dependency_wrappers():
    """Verify backend_shared dependency helper pass-throughs."""
    assert isinstance(is_mock_auth_allowed(), bool)
    with patch("src.core.dependencies._deps.get_jwks_client") as mock_get_client:
        get_jwks_client("http://mock/jwks")
        mock_get_client.assert_called_once_with("http://mock/jwks")

    with patch("src.core.dependencies._deps.decode_oidc_token") as mock_decode:
        mock_decode.return_value = {"sub": "user-123"}
        payload = decode_oidc_token("mock-token")
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
