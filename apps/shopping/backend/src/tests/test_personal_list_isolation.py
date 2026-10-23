"""A personal list is readable and writable only by its owner, never by other users."""

import uuid

import pytest
from backend_shared.household import derive_user_id
from backend_shared.household.testing import DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB, StaticMembershipLookup
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.exceptions import ShoppingListNotFoundError
from src.features.shopping_lists.models import ShoppingItem, ShoppingList
from src.features.shopping_lists.services.list_management_service import ListManagementService

OWNER_ID = derive_user_id(DEFAULT_TEST_SUB)
OTHER_HOME = uuid.uuid4()


async def _personal_list_with_item(db_session: AsyncSession) -> tuple[ShoppingList, ShoppingItem]:
    personal = ShoppingList(
        name="Owner - Liste", home_id=DEFAULT_TEST_HOUSEHOLD_ID, owner_id=OWNER_ID, is_personal=True
    )
    db_session.add(personal)
    await db_session.commit()
    await db_session.refresh(personal)
    item = ShoppingItem(list_id=personal.id, name="Secret", quantity=1.0, unit="piece")
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return personal, item


@pytest.fixture
def intruder_headers(membership: StaticMembershipLookup, auth_headers):
    """Header sets for two non-owners: a member of another household and a co-member of the owner's household."""
    membership.set(OTHER_HOME, "intruder", "MEMBER")
    membership.set(DEFAULT_TEST_HOUSEHOLD_ID, "colleague", "MEMBER")
    return {
        "other_household": auth_headers(sub="intruder", household_id=OTHER_HOME),
        "same_household": auth_headers(sub="colleague", household_id=DEFAULT_TEST_HOUSEHOLD_ID),
    }


@pytest.mark.asyncio
async def test_get_list_service_rejects_non_owner_of_personal_list(db_session: AsyncSession):
    personal, _ = await _personal_list_with_item(db_session)

    assert (await ListManagementService.get_list(db_session, personal.id, OTHER_HOME, OWNER_ID)).id == personal.id
    for home in (OTHER_HOME, DEFAULT_TEST_HOUSEHOLD_ID):
        with pytest.raises(ShoppingListNotFoundError):
            await ListManagementService.get_list(db_session, personal.id, home, uuid.uuid4())


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", ["other_household", "same_household"])
async def test_non_owner_cannot_touch_personal_list(
    client: AsyncClient, db_session: AsyncSession, intruder_headers, scope: str
):
    personal, item = await _personal_list_with_item(db_session)
    headers = intruder_headers[scope]
    base = f"/api/v1/shopping-lists/{personal.id}"

    responses = [
        await client.get(base, headers=headers),
        await client.post(f"{base}/items", json={"name": "Injected", "quantity": 1, "unit": "piece"}, headers=headers),
        await client.patch(f"{base}/items/{item.id}", json={"name": "Hacked"}, headers=headers),
        await client.delete(f"{base}/items/{item.id}", headers=headers),
        await client.post(f"{base}/sync-to-pantry", headers=headers),
        await client.post(f"{base}/auto-import-low-stock", headers=headers),
        await client.delete(base, headers=headers),
    ]
    for response in responses:
        assert response.status_code == 400, response.text
        assert response.json()["detail"]["error_code"] == "shopping.error.list_not_found"

    await db_session.refresh(item)
    assert item.name == "Secret"


@pytest.mark.asyncio
async def test_owner_reaches_personal_list_from_any_household(
    client: AsyncClient, db_session: AsyncSession, membership: StaticMembershipLookup, auth_headers
):
    personal, item = await _personal_list_with_item(db_session)
    membership.set(OTHER_HOME, DEFAULT_TEST_SUB, "MEMBER")
    headers = auth_headers(household_id=OTHER_HOME)
    base = f"/api/v1/shopping-lists/{personal.id}"

    assert (await client.get(base, headers=headers)).status_code == 200
    added = await client.post(f"{base}/items", json={"name": "Milk", "quantity": 1, "unit": "l"}, headers=headers)
    assert added.status_code == 201
    updated = await client.patch(f"{base}/items/{item.id}", json={"name": "Renamed"}, headers=headers)
    assert updated.status_code == 200
    assert (await client.delete(f"{base}/items/{item.id}", headers=headers)).status_code == 204
