import uuid
from unittest.mock import AsyncMock, patch

import pytest
from backend_shared.household import derive_user_id
from backend_shared.household.testing import DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.history.models import ShoppingHistory
from src.features.shopping_lists.models import ShoppingItem, ShoppingList
from src.features.shopping_lists.services.pantry_sync_service import to_pantry_unit

TEST_USER_ID = derive_user_id(DEFAULT_TEST_SUB)
PRODUCT_ID = "e67d26bb-8888-4db9-8eb2-b8ee4d2e7ff2"


async def _list_with_completed_items(db_session: AsyncSession, *items: dict) -> tuple[ShoppingList, list[ShoppingItem]]:
    shopping_list = ShoppingList(name="Retry List", home_id=DEFAULT_TEST_HOUSEHOLD_ID, owner_id=TEST_USER_ID)
    db_session.add(shopping_list)
    await db_session.commit()
    await db_session.refresh(shopping_list)

    rows = [ShoppingItem(list_id=shopping_list.id, is_completed=True, is_synced=False, **fields) for fields in items]
    for row in rows:
        db_session.add(row)
    await db_session.commit()
    for row in rows:
        await db_session.refresh(row)
    return shopping_list, rows


@pytest.mark.parametrize(
    ("stored", "expected"),
    [
        ("stk", "piece"),
        ("Stk", "piece"),
        ("bund", "piece"),
        ("fl.", "bottle"),
        ("pkg.", "pack"),
        ("pkt.", "pack"),
        ("dose", "can"),
        ("g", "g"),
        ("l", "l"),
        ("piece", "piece"),
    ],
)
def test_to_pantry_unit_maps_legacy_codes_only(stored: str, expected: str):
    assert to_pantry_unit(stored) == expected


@pytest.mark.asyncio
@patch("src.features.shopping_lists.clients.PantryClient.bulk_add_items", new_callable=AsyncMock)
async def test_sync_sends_pantry_compatible_units_but_keeps_stored_unit(
    mock_bulk_add: AsyncMock, client: AsyncClient, db_session: AsyncSession
):
    shopping_list, (item,) = await _list_with_completed_items(db_session, {"name": "Oat Milk", "unit": "fl."})
    mock_bulk_add.return_value = {
        "successful_items": [
            {"shopping_item_id": str(item.id), "product_id": PRODUCT_ID, "quantity_added": 1.0, "unit": "bottle"}
        ],
        "unrecognized_items": [],
    }

    response = await client.post(f"/api/v1/shopping-lists/{shopping_list.id}/sync-to-pantry")

    assert response.status_code == 200
    assert mock_bulk_add.await_args is not None
    sent = mock_bulk_add.await_args.kwargs["items"]
    assert sent[0]["unit"] == "bottle"
    await db_session.refresh(item)
    assert item.unit == "fl."
    assert item.is_synced is True


@pytest.mark.asyncio
@patch("src.features.shopping_lists.clients.PantryClient.bulk_add_items", new_callable=AsyncMock)
async def test_sync_with_item_ids_retries_only_those_items_and_links_the_product(
    mock_bulk_add: AsyncMock, client: AsyncClient, db_session: AsyncSession
):
    shopping_list, (retried, untouched) = await _list_with_completed_items(
        db_session,
        {"name": "Wild Berries", "unit": "pack"},
        {"name": "Mystery Jar", "unit": "piece"},
    )
    mock_bulk_add.return_value = {
        "successful_items": [
            {"shopping_item_id": str(retried.id), "product_id": PRODUCT_ID, "quantity_added": 1.0, "unit": "pack"}
        ],
        "unrecognized_items": [],
    }

    response = await client.post(
        f"/api/v1/shopping-lists/{shopping_list.id}/sync-to-pantry",
        json={"item_ids": [str(retried.id)]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["synced_count"] == 1

    assert mock_bulk_add.await_args is not None
    sent_ids = [entry["shopping_item_id"] for entry in mock_bulk_add.await_args.kwargs["items"]]
    assert sent_ids == [str(retried.id)]

    await db_session.refresh(retried)
    await db_session.refresh(untouched)
    assert retried.is_synced is True
    assert retried.product_id == uuid.UUID(PRODUCT_ID)
    assert untouched.is_synced is False
    assert untouched.product_id is None


@pytest.mark.asyncio
@patch("src.features.shopping_lists.clients.PantryClient.bulk_add_items", new_callable=AsyncMock)
async def test_retry_does_not_count_the_purchase_in_history_again(
    mock_bulk_add: AsyncMock, client: AsyncClient, db_session: AsyncSession
):
    shopping_list, (item,) = await _list_with_completed_items(db_session, {"name": "Wild Berries", "unit": "pack"})
    mock_bulk_add.return_value = {
        "successful_items": [],
        "unrecognized_items": [
            {
                "shopping_item_id": str(item.id),
                "name": "Wild Berries",
                "quantity": 1.0,
                "unit": "pack",
                "reason": "pantry.error.product_not_found",
            }
        ],
    }
    first = await client.post(f"/api/v1/shopping-lists/{shopping_list.id}/sync-to-pantry")
    assert first.json()["unrecognized_count"] == 1

    mock_bulk_add.return_value = {
        "successful_items": [
            {"shopping_item_id": str(item.id), "product_id": PRODUCT_ID, "quantity_added": 1.0, "unit": "pack"}
        ],
        "unrecognized_items": [],
    }
    retry = await client.post(
        f"/api/v1/shopping-lists/{shopping_list.id}/sync-to-pantry",
        json={"item_ids": [str(item.id)]},
    )
    assert retry.json()["synced_count"] == 1

    histories = (await db_session.exec(select(ShoppingHistory))).all()
    assert len(histories) == 1
    assert histories[0].purchase_count == 1


@pytest.mark.asyncio
@patch("src.features.shopping_lists.clients.PantryClient.bulk_add_items", new_callable=AsyncMock)
async def test_retry_with_unknown_item_ids_is_a_no_op(
    mock_bulk_add: AsyncMock, client: AsyncClient, db_session: AsyncSession
):
    shopping_list, _ = await _list_with_completed_items(db_session, {"name": "Wild Berries", "unit": "pack"})

    response = await client.post(
        f"/api/v1/shopping-lists/{shopping_list.id}/sync-to-pantry",
        json={"item_ids": [str(uuid.uuid4())]},
    )

    assert response.status_code == 200
    assert response.json()["synced_count"] == 0
    mock_bulk_add.assert_not_awaited()
