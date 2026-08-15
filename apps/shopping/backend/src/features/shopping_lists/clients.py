import uuid

import httpx

from src.core.config import settings
from src.core.exceptions import PantryServiceError


class PantryClient:
    """HTTP integration client communicating with the digital Pantry Backend."""

    def __init__(self, timeout: float = 5.0):
        self.base_url = settings.PANTRY_BACKEND_URL.rstrip("/")
        self.timeout = timeout

    async def fetch_low_stock_items(
        self, token: str | None = None, household_id: uuid.UUID | None = None
    ) -> list[dict]:
        """Fetch low stock product list from Pantry backend."""
        headers = {}
        if token:
            headers["Authorization"] = token
        if household_id:
            headers["X-Household-ID"] = str(household_id)

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
                raise PantryServiceError(f"Pantry service network request failed: {e}") from e

    async def bulk_add_items(
        self, items: list[dict], token: str | None = None, household_id: uuid.UUID | None = None
    ) -> dict:
        """Post purchased shopping items in bulk to the Pantry backend."""
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = token
        if household_id:
            headers["X-Household-ID"] = str(household_id)

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
                raise PantryServiceError(f"Pantry sync bulk-add network request failed: {e}") from e
