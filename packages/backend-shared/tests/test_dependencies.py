"""Tests for OIDC token validation: required claims, generic errors, JWKS refresh cooldown, event-loop safety."""

import json
import threading
import time
from types import SimpleNamespace

import jwt
import jwt.algorithms
import pytest
from backend_shared import dependencies as deps
from backend_shared import household as hh
from backend_shared import oidc_discovery
from backend_shared.dependencies import JWKS_REFRESH_COOLDOWN_SECONDS, decode_oidc_token
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

ISSUER = "https://issuer.example.org"
AUDIENCE = "alfheim"
JWKS_URL = "https://issuer.example.org/keys"
HOUSEHOLD_ID = "11111111-2222-3333-4444-555555555555"


@pytest.fixture(autouse=True)
def _production_like(monkeypatch):
    """Disable the mock-auth bypass so real signature validation runs."""
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setattr(deps, "_jwks_clients", {})


def _make_key(kid: str):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    jwk.update({"kid": kid, "alg": "RS256", "use": "sig"})
    return private, jwk


def _sign(private, kid: str, **overrides) -> str:
    """Sign a valid token; an override of ``None`` removes that claim."""
    now = int(time.time())
    payload = {"iss": ISSUER, "aud": AUDIENCE, "sub": "user-1", "iat": now, "exp": now + 300}
    for name, value in overrides.items():
        if value is None:
            payload.pop(name, None)
        else:
            payload[name] = value
    return jwt.encode(payload, private, algorithm="RS256", headers={"kid": kid})


def _settings():
    return SimpleNamespace(expected_issuer=ISSUER, OIDC_AUDIENCE=AUDIENCE, jwks_url=JWKS_URL)


class FakeJWKS:
    """Replaces PyJWKClient.fetch_data with an in-memory key set and records network fetches."""

    def __init__(self, monkeypatch, *keys: dict) -> None:
        self.keys = list(keys)
        self.fetches = 0
        self.threads: list[int] = []

        def fetch_data(client):
            self.fetches += 1
            self.threads.append(threading.get_ident())
            jwk_set = {"keys": list(self.keys)}
            client.jwk_set_cache.put(jwk_set)
            client._last_successful_fetch = time.monotonic()
            return jwk_set

        monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", fetch_data)


class _Member:
    async def __call__(self, household_id, user_sub):
        return "MEMBER"


def test_valid_token_is_accepted(monkeypatch):
    private, jwk = _make_key("k1")
    FakeJWKS(monkeypatch, jwk)
    claims = decode_oidc_token(_sign(private, "k1"), _settings())
    assert claims["sub"] == "user-1"


@pytest.mark.parametrize("missing", ["exp", "iat", "sub"])
def test_token_without_required_claim_is_rejected(monkeypatch, missing):
    private, jwk = _make_key("k1")
    FakeJWKS(monkeypatch, jwk)
    with pytest.raises(HTTPException) as exc:
        decode_oidc_token(_sign(private, "k1", **{missing: None}), _settings())
    assert exc.value.status_code == 401
    assert exc.value.detail == "invalid or expired token"


def test_error_detail_does_not_leak_exception_text(monkeypatch):
    private, jwk = _make_key("k1")
    FakeJWKS(monkeypatch, jwk)
    with pytest.raises(HTTPException) as exc:
        decode_oidc_token(_sign(private, "k1", aud="someone-else"), _settings())
    assert exc.value.detail == "invalid or expired token"


def test_unknown_kid_refreshes_jwks_at_most_once_per_cooldown(monkeypatch):
    private, jwk = _make_key("k1")
    rogue, _ = _make_key("rogue")
    fake = FakeJWKS(monkeypatch, jwk)

    decode_oidc_token(_sign(private, "k1"), _settings())
    assert fake.fetches == 1

    # Unknown kid inside the cooldown window: rejected without any further network call.
    for _ in range(5):
        with pytest.raises(HTTPException) as exc:
            decode_oidc_token(_sign(rogue, "rogue"), _settings())
        assert exc.value.status_code == 401
    assert fake.fetches == 1

    # Once the cooldown has elapsed one forced refresh is allowed again (key rotation keeps working).
    client = deps.get_jwks_client(JWKS_URL)
    client._last_successful_fetch = time.monotonic() - JWKS_REFRESH_COOLDOWN_SECONDS - 1
    with pytest.raises(HTTPException):
        decode_oidc_token(_sign(rogue, "rogue"), _settings())
    assert fake.fetches == 2


def test_jwks_cooldown_is_sixty_seconds():
    assert JWKS_REFRESH_COOLDOWN_SECONDS == 60
    assert deps.get_jwks_client(JWKS_URL).cooldown_duration == 60


@pytest.mark.asyncio
async def test_async_authentication_does_not_block_the_event_loop(monkeypatch):
    private, jwk = _make_key("k1")
    fake = FakeJWKS(monkeypatch, jwk)

    context = await hh.resolve_household_context(
        f"Bearer {_sign(private, 'k1')}", HOUSEHOLD_ID, settings=_settings(), lookup=_Member()
    )
    assert context.user_sub == "user-1"
    assert fake.threads
    assert fake.threads[0] != threading.get_ident()


@pytest.mark.asyncio
async def test_household_401_detail_is_generic(monkeypatch):
    private, jwk = _make_key("k1")
    FakeJWKS(monkeypatch, jwk)
    token = _sign(private, "k1", aud="someone-else")
    with pytest.raises(hh.HouseholdAuthError) as exc:
        await hh.resolve_household_context(f"Bearer {token}", HOUSEHOLD_ID, settings=_settings(), lookup=_Member())
    assert exc.value.status_code == 401
    assert exc.value.message == "invalid or expired token"


def test_discovery_failure_detail_is_generic(monkeypatch):
    monkeypatch.setattr(oidc_discovery, "_discovered_jwks_uris", {})
    with pytest.raises(HTTPException) as exc:
        oidc_discovery.get_jwks_uri("http://127.0.0.1:1")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Unable to discover OIDC JWKS configuration"
