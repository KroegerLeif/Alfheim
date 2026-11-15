"""CORS allowlist shared by every Python backend (#921).

``CORS_ORIGINS`` accepts a comma-separated list (the form ``compose.prod.yaml`` renders from the
operator's domain, shared with the Go backends' ``CORS_ALLOWED_ORIGINS``) or a JSON list. Every
entry must be an exact origin, ``scheme://host[:port]``; a wildcard or any other malformed entry
fails settings validation, so the service refuses to start rather than widening the list.

Without ``CORS_ORIGINS`` a development backend allows the local dev hosts and a production backend
allows no cross-origin access at all: the frontends reach the APIs same-origin through Caddy.
"""

import json
from typing import Annotated, Protocol
from urllib.parse import urlsplit

from pydantic import BeforeValidator
from pydantic_settings import NoDecode

DEV_CORS_ORIGINS: tuple[str, ...] = (
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://alfheim.loegien.localhost",
    "http://api.alfheim.loegien.localhost",
)


def _normalise_origin(entry: str) -> str:
    if "*" in entry:
        raise ValueError(f"wildcard origin {entry!r} is not allowed; list each origin")
    try:
        parts = urlsplit(entry)
        port = parts.port
    except ValueError as exc:
        raise ValueError(f"invalid origin {entry!r}: {exc}") from exc
    scheme = parts.scheme.lower()
    if scheme not in {"http", "https"}:
        raise ValueError(f"origin {entry!r} must start with http:// or https://")
    host = (parts.hostname or "").lower()
    if (
        not host
        or " " in host
        or parts.username is not None
        or parts.path not in {"", "/"}
        or parts.query
        or parts.fragment
    ):
        raise ValueError(f"{entry!r} is not an origin (scheme://host[:port] only)")
    return f"{scheme}://{host}" + (f":{port}" if port is not None else "")


def parse_cors_origins(value: object) -> list[str]:
    """Parse and validate a CORS origin list.

    Args:
        value: A comma-separated string, a JSON list string or a list of strings.

    Returns:
        The normalised origins (lower-case scheme and host, no trailing slash); empty entries are
        skipped, so an empty value means no cross-origin access.

    Raises:
        ValueError: An entry is a wildcard or not an exact http(s) origin.
    """
    if isinstance(value, str):
        stripped = value.strip()
        entries = json.loads(stripped) if stripped.startswith("[") else stripped.split(",")
    elif isinstance(value, list | tuple):
        entries = list(value)
    else:
        raise ValueError(f"CORS origins must be a string or a list, got {type(value).__name__}")
    origins: list[str] = []
    for entry in entries:
        if not isinstance(entry, str):
            raise ValueError(f"CORS origin {entry!r} is not a string")
        if entry.strip():
            origins.append(_normalise_origin(entry.strip()))
    return origins


CorsOrigins = Annotated[list[str], NoDecode, BeforeValidator(parse_cors_origins)]
"""Settings field type for ``CORS_ORIGINS``: comma-separated or JSON, validated, fail closed."""


class CorsSettings(Protocol):
    """Settings fields ``resolve_cors_origins`` reads (a pydantic-settings model)."""

    ENVIRONMENT: str
    CORS_ORIGINS: list[str]

    @property
    def model_fields_set(self) -> set[str]:
        """Names of the fields that were set explicitly (from the environment or .env)."""
        ...


def resolve_cors_origins(settings: CorsSettings) -> list[str]:
    """Return the origins the CORS middleware may allow.

    Args:
        settings: The backend's settings.

    Returns:
        ``CORS_ORIGINS`` when it was configured; otherwise the development default outside
        production and an empty list in production, so a production backend never falls back to
        the dev hosts.
    """
    if "CORS_ORIGINS" in settings.model_fields_set:
        return list(settings.CORS_ORIGINS)
    if settings.ENVIRONMENT.strip().lower() == "production":
        return []
    return list(DEV_CORS_ORIGINS)
