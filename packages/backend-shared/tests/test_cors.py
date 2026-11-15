"""Tests for the shared CORS allowlist (``backend_shared.cors``)."""

import pytest
from backend_shared.cors import DEV_CORS_ORIGINS, CorsOrigins, parse_cors_origins, resolve_cors_origins
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from pydantic_settings import BaseSettings


class _Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: CorsOrigins = list(DEV_CORS_ORIGINS)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (
            "https://Alfheim.Example.com/, https://alfheim.example.com:8443",
            ["https://alfheim.example.com", "https://alfheim.example.com:8443"],
        ),
        ('["http://localhost:3000"]', ["http://localhost:3000"]),
        (["http://localhost:3000"], ["http://localhost:3000"]),
        ("", []),
        (" , ", []),
    ],
)
def test_parse_cors_origins(raw: object, expected: list[str]) -> None:
    """Comma-separated and JSON forms are accepted and normalised."""
    assert parse_cors_origins(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "*",
        "https://*.example.com",
        "https://ok.example.com,*",
        "ftp://example.com",
        "example.com",
        "https://example.com/app",
        "https://example.com?x=1",
        "https://example.com#frag",
        "https://user@example.com",
        "https://",
        "https://example.com:notaport",
        "https://exa mple.com",
        "[1]",
        42,
    ],
)
def test_parse_cors_origins_fails_closed(raw: object) -> None:
    """A wildcard or malformed entry rejects the whole list."""
    with pytest.raises(ValueError, match=r"origin|CORS"):
        parse_cors_origins(raw)


def test_settings_read_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """The compose.prod.yaml form (comma-separated) reaches the settings."""
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example,https://b.example")
    assert _Settings().CORS_ORIGINS == ["https://a.example", "https://b.example"]


def test_settings_reject_a_wildcard(monkeypatch: pytest.MonkeyPatch) -> None:
    """A wildcard in the environment fails settings validation (startup)."""
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(ValidationError):
        _Settings()


def test_resolve_cors_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unset: dev hosts in development, nothing in production; set: exactly the configured list."""
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    assert resolve_cors_origins(_Settings()) == list(DEV_CORS_ORIGINS)

    monkeypatch.setenv("ENVIRONMENT", "production")
    assert resolve_cors_origins(_Settings()) == []

    monkeypatch.setenv("CORS_ORIGINS", "")
    assert resolve_cors_origins(_Settings()) == []

    monkeypatch.setenv("CORS_ORIGINS", "https://alfheim.example.com")
    assert resolve_cors_origins(_Settings()) == ["https://alfheim.example.com"]


@pytest.mark.asyncio
async def test_production_backend_rejects_an_unlisted_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    """A production backend answers a preflight only for its own origin (#921)."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://alfheim.example.com")
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolve_cors_origins(_Settings()),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    async def ping() -> dict[str, str]:
        return {"ok": "yes"}

    app.add_api_route("/ping", ping)
    preflight = {"Access-Control-Request-Method": "GET"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        allowed = await client.options("/ping", headers={"Origin": "https://alfheim.example.com", **preflight})
        rejected = await client.options("/ping", headers={"Origin": "http://localhost:3000", **preflight})
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://alfheim.example.com"
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers
