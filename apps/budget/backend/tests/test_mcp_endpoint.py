"""End-to-end MCP transport test: the app lifespan starts the session manager and /mcp serves real JSON-RPC."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from backend_shared.household.testing import (
    DEFAULT_TEST_HOUSEHOLD_ID,
    DEFAULT_TEST_SUB,
    make_test_token,
    mcp_list_tools,
    mcp_membership,
)
from httpx import ASGITransport, AsyncClient
from src.main import app

AUTH = {"Authorization": f"Bearer {make_test_token(DEFAULT_TEST_SUB)}"}
HEADERS = {**AUTH, "X-Household-ID": str(DEFAULT_TEST_HOUSEHOLD_ID)}


@asynccontextmanager
async def mcp_client() -> AsyncIterator[AsyncClient]:
    """Run the real application lifespan (DB init stubbed) and talk to the app over ASGI.

    A context manager rather than a fixture: the MCP session manager's task group must be
    entered and exited in the same task, which async-generator fixtures do not guarantee.
    """
    with (
        patch("src.main.init_db", new_callable=AsyncMock),
        patch("src.main.shutdown_telemetry"),
        mcp_membership({(DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB): "OWNER"}),
    ):
        async with app.router.lifespan_context(app):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://budget-backend:8000") as client:
                yield client


@pytest.mark.asyncio
async def test_mcp_initialize_and_list_tools():
    async with mcp_client() as client:
        tools = await mcp_list_tools(client, HEADERS)
    assert {"get_pot_balances", "suggest_budget_allocation", "get_budget_status"} <= set(tools)


@pytest.mark.asyncio
async def test_mcp_requires_authentication():
    async with mcp_client() as client:
        response = await client.post("/mcp", headers={"X-Household-ID": str(DEFAULT_TEST_HOUSEHOLD_ID)}, json={})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mcp_requires_household():
    async with mcp_client() as client:
        response = await client.post("/mcp", headers=AUTH, json={})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"
