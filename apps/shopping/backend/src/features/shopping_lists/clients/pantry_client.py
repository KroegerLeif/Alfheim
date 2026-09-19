import uuid

import httpx
from backend_shared.household import HOUSEHOLD_HEADER
from src.core.config import settings
from src.core.exceptions import PantryServiceError


def build_forward_headers(token: str | None, household_id: uuid.UUID) -> dict[str, str]:
    """Forward the caller's bearer token and household to Pantry.

    Pantry authorizes the request itself (JWT + household membership), so Shopping
    never vouches for the caller: it only passes on what it received.
    """
    headers = {HOUSEHOLD_HEADER: str(household_id)}
    if token:
        headers["Authorization"] = token if token.lower().startswith("bearer ") else f"Bearer {token}"
    return headers


class PantryClient:
    """HTTP integration client communicating with the digital Pantry Backend."""

    def __init__(self, timeout: float = 5.0):
        self.base_url = settings.PANTRY_BACKEND_URL.rstrip("/")
        self.timeout = timeout

    async def fetch_low_stock_items(self, token: str | None, household_id: uuid.UUID) -> list[dict]:
        """Fetch low stock product list from Pantry backend on behalf of the caller."""
        headers = build_forward_headers(token, household_id)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/v1/inventory/low-stock",
                    headers=headers,
                )
                if response.status_code != 200:
                    raise PantryServiceError(f"Pantry service returned status code {response.status_code}.")
                return response.json()
            except httpx.RequestError as e:
                raise PantryServiceError(f"Pantry service network request failed: {e}")

    async def bulk_add_items(self, items: list[dict], token: str | None, household_id: uuid.UUID) -> dict:
        """Post purchased shopping items in bulk to the Pantry backend on behalf of the caller."""
        headers = {"Content-Type": "application/json", **build_forward_headers(token, household_id)}

        payload = {"items": items}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/inventory/bulk-add",
                    json=payload,
                    headers=headers,
                )
                if response.status_code != 200:
                    raise PantryServiceError(f"Pantry sync bulk-add returned status code {response.status_code}.")
                return response.json()
            except httpx.RequestError as e:
                raise PantryServiceError(f"Pantry sync bulk-add network request failed: {e}")
