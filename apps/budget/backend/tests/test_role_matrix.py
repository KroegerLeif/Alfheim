"""Household role matrix of Budget: GUEST is read-only, destructive routes need ADMIN or OWNER."""

from uuid import uuid4

import pytest
from backend_shared.household import HouseholdRole
from httpx import AsyncClient
from tests.helpers import create_auth_headers

PAYLOAD = {"name": "Role Matrix", "account_type": "CHECKING"}

#: Representative state-changing routes (the 403 is raised before the body is validated).
WRITE_ROUTES = [
    ("POST", "/api/v1/accounts/"),
    ("PATCH", f"/api/v1/accounts/{uuid4()}"),
    ("POST", "/api/v1/pots/"),
    ("POST", "/api/v1/pots/cascade"),
    ("PATCH", f"/api/v1/pots/{uuid4()}"),
    ("POST", "/api/v1/plans/"),
    ("PATCH", f"/api/v1/plans/{uuid4()}"),
    ("POST", "/api/v1/transactions/"),
    ("POST", "/api/v1/transactions/quick-add"),
    ("PATCH", f"/api/v1/transactions/{uuid4()}"),
    ("DELETE", f"/api/v1/transactions/{uuid4()}"),
]

ADMIN_ONLY_ROUTES = [
    f"/api/v1/accounts/{uuid4()}",
    f"/api/v1/pots/{uuid4()}",
    f"/api/v1/plans/{uuid4()}",
]


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), WRITE_ROUTES)
async def test_guest_cannot_write(client: AsyncClient, method: str, path: str):
    headers = create_auth_headers(role="GUEST")

    response = await client.request(method, path, headers=headers, json={})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ADMIN_ONLY_ROUTES)
@pytest.mark.parametrize("role", ["GUEST", "MEMBER"])
async def test_destructive_routes_reject_guest_and_member(client: AsyncClient, path: str, role: HouseholdRole):
    headers = create_auth_headers(role=role)

    response = await client.delete(path, headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
async def test_guest_can_still_read(client: AsyncClient):
    response = await client.get("/api/v1/accounts/", headers=create_auth_headers(role="GUEST"))

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_member_writes_but_cannot_delete_account(client: AsyncClient):
    household_id = str(uuid4())
    owner = create_auth_headers(household_id=household_id, role="OWNER")
    member = create_auth_headers(household_id=household_id, role="MEMBER")

    created = await client.post("/api/v1/accounts/", headers=member, json=PAYLOAD)
    assert created.status_code == 201
    account_id = created.json()["id"]

    updated = await client.patch(f"/api/v1/accounts/{account_id}", headers=member, json={"name": "Renamed"})
    assert updated.status_code == 200

    denied = await client.delete(f"/api/v1/accounts/{account_id}", headers=member)
    assert denied.status_code == 403
    assert (await client.get(f"/api/v1/accounts/{account_id}", headers=owner)).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
async def test_admin_and_owner_delete_account(client: AsyncClient, role: HouseholdRole):
    headers = create_auth_headers(role=role)
    created = await client.post("/api/v1/accounts/", headers=headers, json=PAYLOAD)
    assert created.status_code == 201

    deleted = await client.delete(f"/api/v1/accounts/{created.json()['id']}", headers=headers)

    assert deleted.status_code == 204


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
async def test_admin_and_owner_delete_pot_and_plan(client: AsyncClient, role: HouseholdRole):
    headers = create_auth_headers(role=role)
    pot = await client.post("/api/v1/pots/", headers=headers, json={"name": "P", "priority": 1})
    plan = await client.post(
        "/api/v1/plans/", headers=headers, json={"name": "Plan", "plan_type": "MONTHLY", "total_budget": "10.00"}
    )
    assert pot.status_code == 201
    assert plan.status_code == 201

    assert (await client.delete(f"/api/v1/pots/{pot.json()['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"/api/v1/plans/{plan.json()['id']}", headers=headers)).status_code == 204
