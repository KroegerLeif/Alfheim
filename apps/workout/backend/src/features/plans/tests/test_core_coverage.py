from unittest.mock import MagicMock

from backend_shared import oidc_discovery
from fastapi import Request
from src.core.config import Settings
from src.main import value_error_exception_handler


def test_settings_properties():
    """Verify Settings property accessors for the OIDC issuer and JWKS URLs."""
    s = Settings(OIDC_JWKS_URL="http://custom/certs")
    assert s.jwks_url == "http://custom/certs"

    s2 = Settings(
        OIDC_ISSUER_URL="http://auth.example.com/",
        OIDC_JWKS_URL="",
    )
    assert s2.expected_issuer == "http://auth.example.com"


def test_jwks_url_uses_cached_discovery(monkeypatch):
    """Without an override the JWKS URL comes from the shared, cached OIDC discovery helper."""
    calls = []

    def fake_get_jwks_uri(issuer_url: str) -> str:
        calls.append(issuer_url)
        return "http://auth.example.com/oauth/v2/keys"

    monkeypatch.setattr(oidc_discovery, "get_jwks_uri", fake_get_jwks_uri)
    s = Settings(OIDC_ISSUER_URL="http://auth.example.com", OIDC_JWKS_URL="")
    assert s.jwks_url == "http://auth.example.com/oauth/v2/keys"
    assert calls == ["http://auth.example.com"]


def test_settings_secure_defaults():
    """DEBUG and SQL echo must default to off."""
    s = Settings()
    assert s.DEBUG is False
    assert s.SQL_ECHO is False


async def test_value_error_handler():
    """Verify value_error_exception_handler converts ValueError to 400."""
    req = MagicMock(spec=Request)
    res = await value_error_exception_handler(req, ValueError("Invalid value parameter"))
    assert res.status_code == 400
    assert b"Invalid value parameter" in res.body
