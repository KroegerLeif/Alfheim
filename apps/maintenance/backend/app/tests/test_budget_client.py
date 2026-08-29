"""
Unit tests for BudgetClient cross-app integration in maintenance backend.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from app.services.budget_client import BudgetClient


@pytest.mark.asyncio
async def test_reserve_maintenance_funds_success():
    """Test successful maintenance reserve trigger request to budget service."""
    household_id = str(uuid4())
    client = BudgetClient(base_url="http://budget-backend:8000")

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 201
    mock_response.json.return_value = {
        "id": str(uuid4()),
        "household_id": household_id,
        "name": "Washing Machine Filter Replacement",
        "target_amount": "150.00",
        "priority": 1,
    }

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        result = await client.reserve_maintenance_funds(
            household_id=household_id,
            title="Washing Machine Filter Replacement",
            required_amount=Decimal("150.00"),
            due_date="2025-06-01",
            priority=1,
        )

        assert result is not None
        assert result["name"] == "Washing Machine Filter Replacement"
        assert result["target_amount"] == "150.00"

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["headers"]["X-Household-ID"] == household_id
        assert call_kwargs["json"]["title"] == "Washing Machine Filter Replacement"
        assert call_kwargs["json"]["required_amount"] == "150.00"


@pytest.mark.asyncio
async def test_reserve_maintenance_funds_http_error():
    """Test handling of HTTP error response from budget service."""
    household_id = str(uuid4())
    client = BudgetClient(base_url="http://budget-backend:8000")

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        result = await client.reserve_maintenance_funds(
            household_id=household_id,
            title="Heat Pump Maintenance",
            required_amount=500.0,
        )

        assert result is None


@pytest.mark.asyncio
async def test_reserve_maintenance_funds_connection_error():
    """Test handling of connection exception when budget backend is unreachable."""
    household_id = str(uuid4())
    client = BudgetClient(base_url="http://budget-backend:8000")

    with patch.object(httpx.AsyncClient, "post", side_effect=httpx.ConnectError("Connection refused")):
        result = await client.reserve_maintenance_funds(
            household_id=household_id,
            title="Solar Inverter Repair",
            required_amount="1200.00",
        )

        assert result is None
