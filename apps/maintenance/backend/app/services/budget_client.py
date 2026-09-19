"""
Budget service client for forwarding maintenance reserve requests to budget backend.
"""

import logging
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class BudgetClient:
    """HTTP Client for communicating with the Budget & Treasury backend service."""

    def __init__(self, base_url: str | None = None) -> None:
        """Initialize BudgetClient with base service URL."""
        self.base_url = base_url or getattr(settings, "BUDGET_SERVICE_URL", "http://budget-backend:8000")

    async def reserve_maintenance_funds(
        self,
        household_id: uuid.UUID,
        title: str,
        required_amount: Decimal | float | str,
        due_date: date | str | None = None,
        priority: int = 1,
        authorization: str | None = None,
    ) -> dict[str, Any]:
        """Trigger a maintenance reserve allocation in the budget service on behalf of the caller.

        The caller's bearer token and the household UUID are forwarded, so the budget service
        confirms the same household membership (via core/household) as this service did.

        Args:
            household_id: UUID of the household (``HouseholdContext.household_id``).
            title: Title of the maintenance reserve.
            required_amount: Required amount for the reserve.
            due_date: Optional due date for the reserve.
            priority: Priority level (default 1).
            authorization: The caller's ``Authorization: Bearer ...`` header value (required).

        Returns:
            The budget service response as a dictionary.

        Raises:
            ValueError: If authorization is missing or not a bearer token, or household_id is not a UUID.
            httpx.HTTPError: If the budget service returns an error or is unreachable.
        """
        if not authorization or not authorization.lower().startswith("bearer "):
            raise ValueError("A bearer Authorization header is required for reserve_maintenance_funds")
        if not isinstance(household_id, uuid.UUID):
            raise ValueError("household_id must be a UUID (households are owned by core/household)")

        url = f"{self.base_url.rstrip('/')}/api/v1/pots/maintenance-reserve"
        headers = {
            "X-Household-ID": str(household_id),
            "Content-Type": "application/json",
            "Authorization": authorization,
        }
        payload = {
            "title": title,
            "required_amount": str(required_amount) if isinstance(required_amount, Decimal) else required_amount,
            "due_date": str(due_date) if due_date else None,
            "priority": priority,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=5.0)
            if response.status_code in (200, 201):
                return response.json()
            elif response.status_code == 401:
                logger.error(
                    "Authorization failed when calling budget backend: status %d",
                    response.status_code,
                )
                raise httpx.HTTPStatusError(
                    f"Budget service rejected authorization (HTTP {response.status_code})",
                    request=response.request,
                    response=response,
                )
            else:
                logger.error(
                    "Budget backend returned error: status %d, response: %s",
                    response.status_code,
                    response.text,
                )
                raise httpx.HTTPStatusError(
                    f"Budget service error (HTTP {response.status_code})",
                    request=response.request,
                    response=response,
                )
