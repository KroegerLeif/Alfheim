"""OIDC JWT validation shared by all backends (household authorization lives in :mod:`backend_shared.household`)."""

import logging
import os
import sys
from typing import Any
from urllib.parse import urlparse

import jwt
from fastapi import HTTPException, status

from backend_shared.tls import get_oidc_ssl_context

logger = logging.getLogger(__name__)

SAFE_TEST_HOSTS = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "test",
    "testserver",
    "postgres",
    "zitadel",
    "alfheim_zitadel",
    "pantry-backend",
    "shopping-backend",
    "chores-backend",
    "maintenance-backend",
}

SAFE_TEST_SUFFIXES = (
    ".localhost",
    ".test",
    ".local",
    ".internal",
    ".loegien.localhost",
)


#: Minimum seconds between forced JWKS refreshes triggered by an unknown ``kid``. Within this window a token
#: signed with an unknown key is rejected without any network call, so unauthenticated callers cannot make a
#: backend hammer the identity provider.
JWKS_REFRESH_COOLDOWN_SECONDS = 60

#: Claims every accepted access token must carry.
REQUIRED_TOKEN_CLAIMS = ["exp", "iat", "sub"]

INVALID_TOKEN_DETAIL = "invalid or expired token"

_jwks_clients: dict[str, jwt.PyJWKClient] = {}


def _is_safe_test_url(url: str | None) -> bool:
    """Validate that a URL points to a local or container test service, not remote production infrastructure."""
    if not url:
        return True
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return True
        if hostname in SAFE_TEST_HOSTS:
            return True
        if any(hostname.endswith(suffix) for suffix in SAFE_TEST_SUFFIXES):
            return True
        return False
    except (ValueError, AttributeError) as e:
        logger.warning("Failed to parse test URL '%s': %s", url, e)
        return False


def is_explicit_dev_or_test_environment() -> bool:
    """True only when the process is explicitly marked as development or test (never by default).

    An explicit ``ENVIRONMENT`` always decides. When it is unset only a test runner (pytest / ``TESTING=true``)
    qualifies; a plain unset ``ENVIRONMENT`` does not: development-only conveniences (default storage credentials, weak
    internal tokens) must never silently apply to a deployment that merely forgot to set it.
    """
    env = (os.getenv("ENVIRONMENT") or "").strip().lower()
    if env:
        return env in ("development", "dev", "testing", "test")
    # ``pytest`` in sys.modules covers import-time checks during test collection, before PYTEST_CURRENT_TEST is set.
    return bool(os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING") == "true" or "pytest" in sys.modules)


def is_mock_auth_allowed(settings: Any = None) -> bool:
    """Ensure mock authentication and test token bypass are strictly constrained to explicit test execution contexts."""
    env = (getattr(settings, "ENVIRONMENT", os.getenv("ENVIRONMENT", "")) or "").strip().lower()
    if env in ("production", "prod", "staging", "stage"):
        return False

    is_explicit_test = bool(os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING") == "true")
    if not is_explicit_test and env != "testing":
        return False

    if settings:
        if not _is_safe_test_url(getattr(settings, "DATABASE_URL", None)):
            logger.error(
                "Mock auth rejected: non-localhost/unsafe DATABASE_URL detected: %s",
                getattr(settings, "DATABASE_URL", None),
            )
            return False

        for attr in ("OIDC_INTERNAL_URL", "OIDC_ISSUER_URL", "OIDC_JWKS_URL"):
            value = getattr(settings, attr, None)
            if not _is_safe_test_url(value):
                logger.error(
                    "Mock auth rejected: non-localhost/unsafe %s detected: %s",
                    attr,
                    value,
                )
                return False

    return True


def get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = jwt.PyJWKClient(
            jwks_url,
            ssl_context=get_oidc_ssl_context(),
            cooldown_duration=JWKS_REFRESH_COOLDOWN_SECONDS,
        )
    return _jwks_clients[jwks_url]


def decode_oidc_token(token: str, settings: Any = None) -> dict:
    """Validate an OIDC access token and return its claims.

    This function is synchronous and may block on network I/O (OIDC discovery and JWKS fetches). Async callers
    must run it in a worker thread, e.g. ``await anyio.to_thread.run_sync(decode_oidc_token, token, settings)``.
    Failures raise ``HTTPException(401)`` with a generic detail; specifics are only logged.
    """
    if is_mock_auth_allowed(settings):
        try:
            logger.debug("Decoding OIDC token without signature verification in test context.")
            return jwt.decode(token, options={"verify_signature": False, "verify_aud": False, "verify_iss": False})
        except jwt.PyJWTError as e:
            logger.warning("Mock JWT decoding failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=INVALID_TOKEN_DETAIL,
            )

    expected_issuer = getattr(settings, "expected_issuer", None) if settings else None
    expected_audience = getattr(settings, "OIDC_AUDIENCE", None) if settings else None
    jwks_url = getattr(settings, "jwks_url", None) if settings else None

    # Enforce required configuration: issuer, audience, and JWKS URL must be present
    if not expected_issuer:
        logger.error("OIDC issuer is not configured: cannot validate JWT")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OIDC issuer configuration missing",
        )

    if not expected_audience:
        logger.error("OIDC audience is not configured: cannot validate JWT")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OIDC audience configuration missing",
        )

    if not jwks_url:
        logger.error("OIDC JWKS URL is not configured: cannot validate JWT")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OIDC JWKS configuration missing",
        )

    try:
        jwks_client = get_jwks_client(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=expected_audience,
            issuer=expected_issuer,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
                "require": REQUIRED_TOKEN_CLAIMS,
            },
        )
    except HTTPException:
        raise
    except (jwt.PyJWTError, ValueError) as e:
        logger.warning("OIDC JWT validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_TOKEN_DETAIL,
        )
