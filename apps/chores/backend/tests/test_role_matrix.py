"""Household role matrix of Chores: GUEST is read-only, template deletion needs ADMIN or OWNER."""

import uuid

import pytest
from backend_shared.household import HouseholdRole
from backend_shared.household.testing import DEFAULT_TEST_SUB, StaticMembershipLookup
from fastmcp.exceptions import ToolError
from httpx import AsyncClient
from src.features.chore_management import mcp_tools

TEMPLATE = {"name": "Role Matrix", "description": "Wipe", "points": 5}
TEMPLATES_URL = "/api/v1/chores/templates"

WRITE_ROUTES = [
    ("POST", TEMPLATES_URL),
    ("PATCH", f"{TEMPLATES_URL}/{uuid.uuid4()}"),
    ("POST", f"/api/v1/chores/instances/{uuid.uuid4()}/assign"),
    ("POST", f"/api/v1/chores/instances/{uuid.uuid4()}/claim"),
    ("POST", f"/api/v1/chores/instances/{uuid.uuid4()}/complete"),
]


def _as(membership: StaticMembershipLookup, role: HouseholdRole) -> None:
    membership.set(next(iter(membership.memberships))[0], DEFAULT_TEST_SUB, role)


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), WRITE_ROUTES)
async def test_guest_cannot_write(client: AsyncClient, membership, auth_headers, method: str, path: str):
    _as(membership, "GUEST")

    response = await client.request(method, path, headers=auth_headers(), json={})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["GUEST", "MEMBER"])
async def test_template_delete_rejects_guest_and_member(
    client: AsyncClient, membership, auth_headers, role: HouseholdRole
):
    _as(membership, "OWNER")
    created = await client.post(TEMPLATES_URL, headers=auth_headers(), json=TEMPLATE)
    assert created.status_code == 201
    template_id = created.json()["id"]

    _as(membership, role)
    denied = await client.delete(f"{TEMPLATES_URL}/{template_id}", headers=auth_headers())

    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "household_role_forbidden"
    _as(membership, "OWNER")
    assert any(t["id"] == template_id for t in (await client.get(TEMPLATES_URL, headers=auth_headers())).json())


@pytest.mark.asyncio
async def test_member_can_create_and_update_templates(client: AsyncClient, membership, auth_headers):
    _as(membership, "MEMBER")

    created = await client.post(TEMPLATES_URL, headers=auth_headers(), json=TEMPLATE)
    assert created.status_code == 201

    updated = await client.patch(f"{TEMPLATES_URL}/{created.json()['id']}", headers=auth_headers(), json={"points": 7})
    assert updated.status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
async def test_admin_and_owner_delete_template(client: AsyncClient, membership, auth_headers, role: HouseholdRole):
    _as(membership, role)
    created = await client.post(TEMPLATES_URL, headers=auth_headers(), json=TEMPLATE)
    assert created.status_code == 201

    deleted = await client.delete(f"{TEMPLATES_URL}/{created.json()['id']}", headers=auth_headers())

    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_guest_can_still_read(client: AsyncClient, membership, auth_headers):
    _as(membership, "GUEST")

    assert (await client.get(TEMPLATES_URL, headers=auth_headers())).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool_call",
    [
        lambda: mcp_tools.complete_chore_by_name(chore_name="Anything"),
        lambda: mcp_tools.assign_chore(chore_instance_id=str(uuid.uuid4()), assignee_user_id=str(uuid.uuid4())),
    ],
)
async def test_guest_cannot_use_write_tools(tool_call):
    from backend_shared.household.testing import mcp_household_context

    with mcp_household_context(role="GUEST"), pytest.raises(ToolError, match="household_role_forbidden"):
        await tool_call()
