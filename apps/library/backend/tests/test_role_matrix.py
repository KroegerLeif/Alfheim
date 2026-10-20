"""Household role matrix of Library: GUEST is read-only, provider/location deletion needs ADMIN or OWNER."""

import uuid

import pytest
from backend_shared.household import HouseholdRole
from backend_shared.household.testing import DEFAULT_TEST_HOUSEHOLD_ID, override_household
from fastapi import FastAPI
from httpx import AsyncClient

LOCATIONS_URL = "/api/v1/library/locations"
PROVIDERS_URL = "/api/v1/library/providers"
ITEMS_URL = "/api/v1/library/items"

WRITE_ROUTES = [
    ("POST", LOCATIONS_URL),
    ("PUT", f"{LOCATIONS_URL}/{uuid.uuid4()}"),
    ("POST", PROVIDERS_URL),
    ("PUT", f"{PROVIDERS_URL}/{uuid.uuid4()}"),
    ("POST", ITEMS_URL),
    ("PUT", f"{ITEMS_URL}/{uuid.uuid4()}"),
    ("DELETE", f"{ITEMS_URL}/{uuid.uuid4()}"),
    ("POST", f"{ITEMS_URL}/{uuid.uuid4()}/lend"),
    ("POST", f"{ITEMS_URL}/{uuid.uuid4()}/return"),
    ("POST", f"{ITEMS_URL}/{uuid.uuid4()}/manual"),
    ("DELETE", f"{ITEMS_URL}/{uuid.uuid4()}/manual"),
]


def _act_as(app: FastAPI, role: HouseholdRole) -> None:
    override_household(app, household_id=DEFAULT_TEST_HOUSEHOLD_ID, role=role)


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), WRITE_ROUTES)
async def test_guest_cannot_write(client: AsyncClient, test_app: FastAPI, method: str, path: str):
    _act_as(test_app, "GUEST")

    response = await client.request(method, path)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [LOCATIONS_URL, PROVIDERS_URL])
@pytest.mark.parametrize("role", ["GUEST", "MEMBER"])
async def test_destructive_routes_reject_guest_and_member(
    client: AsyncClient, test_app: FastAPI, url: str, role: HouseholdRole
):
    _act_as(test_app, role)

    response = await client.delete(f"{url}/{uuid.uuid4()}")

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
async def test_guest_can_still_read(client: AsyncClient, test_app: FastAPI):
    _act_as(test_app, "GUEST")

    assert (await client.get(LOCATIONS_URL)).status_code == 200


@pytest.mark.asyncio
async def test_member_writes_but_cannot_delete_location(client: AsyncClient, test_app: FastAPI):
    _act_as(test_app, "MEMBER")
    created = await client.post(LOCATIONS_URL, json={"name": "Shelf"})
    assert created.status_code == 201
    location_id = created.json()["id"]

    denied = await client.delete(f"{LOCATIONS_URL}/{location_id}")

    assert denied.status_code == 403
    _act_as(test_app, "OWNER")
    assert (await client.get(f"{LOCATIONS_URL}/{location_id}")).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
async def test_admin_and_owner_delete_location(client: AsyncClient, test_app: FastAPI, role: HouseholdRole):
    _act_as(test_app, role)
    created = await client.post(LOCATIONS_URL, json={"name": "Shelf"})
    assert created.status_code == 201

    deleted = await client.delete(f"{LOCATIONS_URL}/{created.json()['id']}")

    assert deleted.status_code == 204
