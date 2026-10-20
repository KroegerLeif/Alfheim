"""Household role matrix of Maintenance: GUEST is read-only for every state-changing route and MCP tool."""

import pytest
from app.features.tasks import mcp_tools
from app.tests.conftest import TEST_HOUSEHOLD_ID, TEST_USER_SUB
from app.tests.test_maintenance_auth import DEVICE_PAYLOAD
from backend_shared.household import HouseholdRole
from backend_shared.household.testing import StaticMembershipLookup, mcp_household_context
from fastmcp.exceptions import ToolError
from httpx import AsyncClient

WRITE_ROUTES = [
    ("POST", "/api/v1/devices"),
    ("POST", "/api/v1/submit"),
    ("POST", "/api/v1/maintenance/wizard"),
    ("POST", "/api/v1/tasks/1/state"),
]


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), WRITE_ROUTES)
async def test_guest_cannot_write(client: AsyncClient, membership: StaticMembershipLookup, method: str, path: str):
    membership.set(TEST_HOUSEHOLD_ID, TEST_USER_SUB, "GUEST")

    response = await client.request(method, path, json={})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
async def test_guest_can_still_read(client: AsyncClient, membership: StaticMembershipLookup):
    membership.set(TEST_HOUSEHOLD_ID, TEST_USER_SUB, "GUEST")

    assert (await client.get("/api/v1/devices")).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["MEMBER", "ADMIN", "OWNER"])
async def test_member_and_above_create_devices(
    client: AsyncClient, membership: StaticMembershipLookup, role: HouseholdRole
):
    membership.set(TEST_HOUSEHOLD_ID, TEST_USER_SUB, role)

    response = await client.post("/api/v1/devices", json=DEVICE_PAYLOAD)

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_guest_cannot_update_task_state_via_mcp():
    with mcp_household_context(role="GUEST"), pytest.raises(ToolError, match="household_role_forbidden"):
        await mcp_tools.update_task_state_tool(step_id=1, comment="hijack")
