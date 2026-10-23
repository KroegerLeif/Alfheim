"""Household role matrix of Shopping: GUEST is read-only for shared lists but keeps its own Personal List."""

import uuid

import pytest
from backend_shared.household import HouseholdRole, derive_user_id
from backend_shared.household.testing import DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB, StaticMembershipLookup
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.shopping_lists.models import ShoppingList

OWNER_ID = derive_user_id(DEFAULT_TEST_SUB)
LISTS_URL = "/api/v1/shopping-lists"


def _act_as(membership: StaticMembershipLookup, role: HouseholdRole) -> None:
    membership.set(DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB, role)


async def _list(db_session: AsyncSession, *, personal: bool) -> ShoppingList:
    shopping_list = ShoppingList(
        name="Role Matrix", home_id=DEFAULT_TEST_HOUSEHOLD_ID, owner_id=OWNER_ID, is_personal=personal
    )
    db_session.add(shopping_list)
    await db_session.commit()
    await db_session.refresh(shopping_list)
    return shopping_list


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", LISTS_URL),
        ("PATCH", f"{LISTS_URL}/reorder"),
        ("POST", "/api/v1/shopping/items"),
        ("DELETE", f"/api/v1/shopping-history/{uuid.uuid4()}"),
    ],
)
async def test_guest_cannot_write_household_data(client: AsyncClient, membership, auth_headers, method, path):
    _act_as(membership, "GUEST")

    response = await client.request(method, path, headers=auth_headers(), json={})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
async def test_guest_cannot_change_shared_list(client: AsyncClient, db_session: AsyncSession, membership, auth_headers):
    shared = await _list(db_session, personal=False)
    _act_as(membership, "GUEST")
    headers = auth_headers()

    for method, path in [
        ("POST", f"{LISTS_URL}/{shared.id}/items"),
        ("PATCH", f"{LISTS_URL}/{shared.id}/items/{uuid.uuid4()}"),
        ("DELETE", f"{LISTS_URL}/{shared.id}/items/{uuid.uuid4()}"),
        ("DELETE", f"{LISTS_URL}/{shared.id}"),
        ("POST", f"{LISTS_URL}/{shared.id}/auto-import-low-stock"),
        ("POST", f"{LISTS_URL}/{shared.id}/sync-to-pantry"),
    ]:
        response = await client.request(method, path, headers=headers, json={})
        assert response.status_code == 403, (method, path)
        assert response.json()["detail"]["code"] == "household_role_forbidden"


@pytest.mark.asyncio
async def test_guest_manages_own_personal_list(client: AsyncClient, db_session: AsyncSession, membership, auth_headers):
    personal = await _list(db_session, personal=True)
    _act_as(membership, "GUEST")
    headers = auth_headers()

    added = await client.post(
        f"{LISTS_URL}/{personal.id}/items", headers=headers, json={"name": "Milk", "quantity": 1, "unit": "piece"}
    )
    assert added.status_code == 201

    removed = await client.delete(f"{LISTS_URL}/{personal.id}/items/{added.json()['id']}", headers=headers)
    assert removed.status_code == 204


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["MEMBER", "ADMIN", "OWNER"])
async def test_member_and_above_change_shared_list(
    client: AsyncClient, db_session: AsyncSession, membership, auth_headers, role: HouseholdRole
):
    shared = await _list(db_session, personal=False)
    _act_as(membership, role)

    added = await client.post(
        f"{LISTS_URL}/{shared.id}/items",
        headers=auth_headers(),
        json={"name": "Bread", "quantity": 1, "unit": "piece"},
    )

    assert added.status_code == 201


@pytest.mark.asyncio
async def test_unknown_list_is_not_a_role_denial_for_guest(client: AsyncClient, membership, auth_headers):
    _act_as(membership, "GUEST")

    response = await client.post(f"{LISTS_URL}/{uuid.uuid4()}/items", headers=auth_headers(), json={})

    assert response.status_code != 403
