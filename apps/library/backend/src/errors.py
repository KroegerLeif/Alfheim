"""Stable, machine-readable error payloads for the Library API.

Error responses follow the household contract: ``{"detail": {"code": ..., "message": ...}}``.
The ``code`` is stable and mapped to localized text by the frontend; ``message`` is English
and meant for logs and API consumers.
"""

from typing import Any

CODE_LOCATION_IN_USE = "location_in_use"
CODE_PROVIDER_IN_USE = "provider_in_use"
CODE_CONFLICT = "conflict"
CODE_LOOKUP_NOT_CONFIGURED = "lookup_not_configured"


def error_detail(code: str, message: str, **extra: Any) -> dict[str, Any]:
    """Build the ``detail`` object of an error response."""
    return {"code": code, "message": message, **extra}
