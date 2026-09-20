from unittest.mock import MagicMock

from fastapi import Request
from src.core.config import Settings
from src.main import value_error_exception_handler


def test_settings_properties():
    """Verify Settings property accessors for the OIDC issuer and JWKS URLs."""
    s = Settings(OIDC_JWKS_URL="http://custom/certs")
    assert s.jwks_url == "http://custom/certs"

    s2 = Settings(
        OIDC_ISSUER_URL="http://auth.example.com",
        OIDC_JWKS_URL="",
    )
    assert s2.jwks_url == "http://auth.example.com/keys"
    assert s2.expected_issuer == "http://auth.example.com"
    assert len(s2.jwks_fallback_urls) > 0


async def test_value_error_handler():
    """Verify value_error_exception_handler converts ValueError to 400."""
    req = MagicMock(spec=Request)
    res = await value_error_exception_handler(req, ValueError("Invalid value parameter"))
    assert res.status_code == 400
    assert b"Invalid value parameter" in res.body
