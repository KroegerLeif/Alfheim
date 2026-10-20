"""Household role matrix of Pantry: GUEST is read-only, location/category deletion needs ADMIN or OWNER."""

import uuid

import pytest
from backend_shared.household import HouseholdRole
from backend_shared.household.testing import (
    DEFAULT_TEST_HOUSEHOLD_ID,
    DEFAULT_TEST_SUB,
    StaticMembershipLookup,
    mcp_household_context,
)
from fastmcp.exceptions import ToolError
from httpx import AsyncClient
from src.features.categories import mcp_tools as category_tools
from src.features.inventory import mcp_tools as inventory_tools
from src.features.locations import mcp_tools as location_tools
from src.features.products.mcp import product_mcp

WRITE_ROUTES = [
    ("POST", "/api/v1/locations"),
    ("PATCH", f"/api/v1/locations/{uuid.uuid4()}"),
    ("POST", "/api/v1/categories"),
    ("PATCH", f"/api/v1/categories/{uuid.uuid4()}"),
    ("POST", "/api/v1/products"),
    ("PATCH", f"/api/v1/products/{uuid.uuid4()}"),
    ("DELETE", f"/api/v1/products/{uuid.uuid4()}"),
    ("PATCH", f"/api/v1/products/{uuid.uuid4()}/nutrition"),
    ("POST", "/api/v1/inventory/transactions"),
    ("POST", "/api/v1/inventory/bulk-add"),
]

ADMIN_ONLY_ROUTES = [f"/api/v1/locations/{uuid.uuid4()}", f"/api/v1/categories/{uuid.uuid4()}"]


def _act_as(membership: StaticMembershipLookup, role: HouseholdRole) -> None:
    membership.set(DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB, role)


@pytest.mark.parametrize(("method", "path"), WRITE_ROUTES)
async def test_guest_cannot_write(client: AsyncClient, membership, auth_headers, method: str, path: str):
    _act_as(membership, "GUEST")

    response = await client.request(method, path, headers=auth_headers(), json={})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.parametrize("path", ADMIN_ONLY_ROUTES)
@pytest.mark.parametrize("role", ["GUEST", "MEMBER"])
async def test_destructive_routes_reject_guest_and_member(client: AsyncClient, membership, auth_headers, path, role):
    _act_as(membership, role)

    response = await client.delete(path, headers=auth_headers())

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


async def test_guest_can_still_read(client: AsyncClient, membership, auth_headers):
    _act_as(membership, "GUEST")

    assert (await client.get("/api/v1/locations", headers=auth_headers())).status_code == 200


@pytest.mark.parametrize("resource", ["locations", "categories"])
async def test_member_writes_but_cannot_delete(client: AsyncClient, membership, auth_headers, resource: str):
    _act_as(membership, "MEMBER")
    created = await client.post(f"/api/v1/{resource}", headers=auth_headers(), json={"name": "Role Matrix"})
    assert created.status_code == 201
    entry_id = created.json()["id"]

    denied = await client.delete(f"/api/v1/{resource}/{entry_id}", headers=auth_headers())

    assert denied.status_code == 403
    _act_as(membership, "ADMIN")
    assert (await client.delete(f"/api/v1/{resource}/{entry_id}", headers=auth_headers())).status_code == 204


@pytest.mark.parametrize(
    "tool_call",
    [
        lambda: product_mcp.create_product(name="X"),
        lambda: product_mcp.update_product(product_id=str(uuid.uuid4()), name="X"),
        lambda: product_mcp.delete_product(product_id=str(uuid.uuid4())),
        lambda: location_tools.create_location(name="X"),
        lambda: location_tools.update_location(location_id=str(uuid.uuid4()), name="X"),
        lambda: category_tools.create_category(name="X"),
        lambda: category_tools.update_category(category_id=str(uuid.uuid4()), name="X"),
        lambda: inventory_tools.record_inventory_movement(
            product_id=str(uuid.uuid4()), location_id=str(uuid.uuid4()), quantity_delta=1.0
        ),
    ],
)
async def test_guest_cannot_use_write_tools(tool_call):
    with mcp_household_context(role="GUEST"), pytest.raises(ToolError, match="household_role_forbidden"):
        await tool_call()


@pytest.mark.parametrize(
    "tool_call",
    [
        lambda: location_tools.delete_location(location_id=str(uuid.uuid4())),
        lambda: category_tools.delete_category(category_id=str(uuid.uuid4())),
    ],
)
@pytest.mark.parametrize("role", ["GUEST", "MEMBER"])
async def test_destructive_tools_reject_guest_and_member(tool_call, role):
    with mcp_household_context(role=role), pytest.raises(ToolError, match="household_role_forbidden"):
        await tool_call()
