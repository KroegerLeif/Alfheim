"""Client for the household app's public API (``core/household``)."""

import logging
from typing import Any

import httpx
from backend_shared.household import get_membership_client
from backend_shared.tls import ExtraCAError, get_oidc_ssl_context

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 5.0

#: Optional httpx transport override (tests mount an ``httpx.MockTransport`` for the household API here).
transport: httpx.AsyncBaseTransport | None = None


def household_api_base_url() -> str:
    """Base URL of the household app (``HOUSEHOLD_INTERNAL_URL``, same setting as the shared membership client)."""
    return get_membership_client().base_url


async def fetch_my_households(token: str | None) -> list[dict[str, Any]] | None:
    """Return the caller's households (with ``role`` and ``is_default``) from ``GET /api/v1/households/me``.

    The caller's own bearer token is forwarded, so the household app answers for
    that user only. Returns ``None`` when there is no token or the household app
    cannot give a usable answer; callers must then fall back to the active
    household only.
    """
    if not token:
        return None
    authorization = token if token.lower().startswith("bearer ") else f"Bearer {token}"
    base_url = household_api_base_url()
    try:
        verify: Any = (get_oidc_ssl_context() or True) if base_url.startswith("https://") else True
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS, verify=verify, transport=transport) as client:
            response = await client.get(f"{base_url}/api/v1/households/me", headers={"Authorization": authorization})
    except (httpx.HTTPError, ExtraCAError) as exc:
        logger.warning("Household app unreachable while listing the caller's households: %s", exc)
        return None

    if response.status_code != 200:
        logger.warning("Household app answered HTTP %s when listing the caller's households", response.status_code)
        return None
    try:
        payload = response.json()
    except ValueError:
        logger.warning("Household app returned an unreadable households list")
        return None
    if not isinstance(payload, list):
        logger.warning("Household app returned an unexpected households payload")
        return None
    return [item for item in payload if isinstance(item, dict)]
