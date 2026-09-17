"""OIDC discovery helpers for resolving JWKS endpoints.

Real OIDC providers (e.g. Zitadel) do not serve their JWKS document at a
fixed, guessable path such as ``{issuer}/keys``. The correct endpoint must be
read from the provider's discovery document at
``{issuer}/.well-known/openid-configuration`` (the ``jwks_uri`` field). This
module resolves and caches that value per issuer so every service performs
at most one discovery request per issuer for the lifetime of the process.
"""

import logging

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

_discovered_jwks_uris: dict[str, str] = {}


def get_jwks_uri(issuer_url: str) -> str:
    """Fetch the OpenID configuration document from ``issuer_url`` and return its ``jwks_uri``.

    Results are cached per normalized issuer URL. Raises ``HTTPException(401)``
    if the discovery document cannot be fetched or does not contain a
    ``jwks_uri`` field.
    """
    normalized_issuer = issuer_url.rstrip("/")
    if normalized_issuer in _discovered_jwks_uris:
        return _discovered_jwks_uris[normalized_issuer]

    discovery_url = f"{normalized_issuer}/.well-known/openid-configuration"
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(discovery_url)
            resp.raise_for_status()
            data = resp.json()
            jwks_uri = data.get("jwks_uri")
            if not jwks_uri:
                raise ValueError("Missing jwks_uri in OpenID configuration")
            _discovered_jwks_uris[normalized_issuer] = jwks_uri
            return jwks_uri
    except Exception as e:
        logger.error("Failed to discover JWKS URI from %s: %s", discovery_url, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unable to discover OIDC JWKS configuration: {e}",
        )


def resolve_jwks_url(issuer_url: str, override: str | None = None) -> str:
    """Return the JWKS endpoint to use: an explicit operator override wins, otherwise OIDC discovery."""
    if override:
        return override
    return get_jwks_uri(issuer_url)
