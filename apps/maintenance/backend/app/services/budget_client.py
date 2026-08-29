"""
Budget service client for forwarding maintenance reserve requests to budget backend.
"""

import logging
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
        household_id: str,
        title: str,
        required_amount: Decimal | float | str,
        due_date: date | str | None = None,
        priority: int = 1,
    ) -> dict[str, Any] | None:
        """Trigger a maintenance reserve allocation in the budget service for a given household."""
        url = f"{self.base_url.rstrip('/')}/api/v1/pots/maintenance-reserve"
        headers = {
            "X-Household-ID": str(household_id),
            "Content-Type": "application/json",
        }
        payload = {
            "title": title,
            "required_amount": str(required_amount) if isinstance(required_amount, Decimal) else required_amount,
            "due_date": str(due_date) if due_date else None,
            "priority": priority,
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers, timeout=5.0)
                if response.status_code in (200, 201):
                    return response.json()
                logger.error(
                    "Failed to trigger maintenance reserve in budget backend: status %d, response: %s",
                    response.status_code,
                    response.text,
                )
                return None
            except Exception as exc:
                logger.error("Error connecting to budget backend at %s: %s", url, exc)
                return None
