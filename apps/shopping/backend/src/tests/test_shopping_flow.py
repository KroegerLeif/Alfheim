import uuid
import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.dependencies import MOCK_USER_ID, MOCK_HOME_ID
from src.features.shopping_lists.models import ShoppingList, ShoppingItem
from src.features.history.models import ShoppingHistory


@pytest.mark.asyncio
async def test_create_retrieve_delete_shopping_list(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a shopping list
    payload = {"name": "Weekly Groceries"}
    response = await client.post("/api/v1/shopping-lists", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Weekly Groceries"
    list_id = data["id"]

    # 2. Retrieve the shopping list
    response = await client.get(f"/api/v1/shopping-lists/{list_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Weekly Groceries"

    # 3. Retrieve all lists
    response = await client.get("/api/v1/shopping-lists")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == list_id

    # 4. Delete the shopping list
    response = await client.delete(f"/api/v1/shopping-lists/{list_id}")
    assert response.status_code == 204

    # 5. Verify it's gone
    response = await client.get(f"/api/v1/shopping-lists/{list_id}")
    assert response.status_code == 400
    assert response.json()["detail"]["error_code"] == "shopping.error.list_not_found"


@pytest.mark.asyncio
async def test_add_and_update_shopping_items(client: AsyncClient, db_session: AsyncSession):
    # Setup list with matching mocked user home space
    l1 = ShoppingList(name="Party List", home_id=MOCK_HOME_ID, owner_id=MOCK_USER_ID)
    db_session.add(l1)
    await db_session.commit()
    await db_session.refresh(l1)

    # 1. Add item
    item_payload = {
        "name": "Coca-Cola",
        "brand": "Coke",
        "barcode": "5449000000096",
        "quantity": 6.0,
        "unit": "bottle",
    }
    response = await client.post(f"/api/v1/shopping-lists/{l1.id}/items", json=item_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Coca-Cola"
    assert data["quantity"] == 6.0
    assert data["is_completed"] is False
    item_id = data["id"]

    # 2. Update item (mark completed & update quantity)
    update_payload = {"quantity": 12.0, "is_completed": True}
    response = await client.patch(f"/api/v1/shopping-lists/{l1.id}/items/{item_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == 12.0
    assert data["is_completed"] is True


@pytest.mark.asyncio
@patch("src.features.shopping_lists.clients.PantryClient.fetch_low_stock_items", new_callable=AsyncMock)
async def test_auto_import_low_stock(mock_fetch: AsyncMock, client: AsyncClient, db_session: AsyncSession):
    # Setup list
    l1 = ShoppingList(name="Pantry Restock", home_id=MOCK_HOME_ID, owner_id=MOCK_USER_ID)
    db_session.add(l1)
    await db_session.commit()
    await db_session.refresh(l1)

    # Add existing active item to prevent duplicate import
    existing_item = ShoppingItem(
        list_id=l1.id,
        name="Apple Juice",
        barcode="4000111222333",
        quantity=2.0,
        unit="l",
        is_completed=False,
    )
    db_session.add(existing_item)
    await db_session.commit()

    # Mock Pantry response
    mock_fetch.return_value = [
        {
            "product": {
                "id": "f82b7b2f-2879-4d69-be5a-19156ee19d27",
                "name": "Apple Juice",
                "brand": "Brand A",
                "barcode": "4000111222333",
                "base_unit": "l",
                "minimum_stock": 10.0,
            },
            "current_stock": 3.0,
        },
        {
            "product": {
                "id": "e67d26bb-8888-4db9-8eb2-b8ee4d2e7ff2",
                "name": "Basmati Rice",
                "brand": "Brand B",
                "barcode": "4000333333333",
                "base_unit": "g",
                "minimum_stock": 2000.0,
            },
            "current_stock": 500.0,
        }
    ]

    # Trigger auto import
    response = await client.post(f"/api/v1/shopping-lists/{l1.id}/auto-import-low-stock")
    assert response.status_code == 200
    imported = response.json()

    # Verify merge logic: Apple Juice skipped (already active), Basmati Rice imported
    assert len(imported) == 1
    assert imported[0]["name"] == "Basmati Rice"
    
    # Deficiency deficit calculation: minimum (2000) - current (500) = 1500
    assert imported[0]["quantity"] == 1500.0
    assert imported[0]["unit"] == "g"
    assert imported[0]["is_auto_generated"] is True
    assert imported[0]["product_id"] == "e67d26bb-8888-4db9-8eb2-b8ee4d2e7ff2"


@pytest.mark.asyncio
@patch("src.features.shopping_lists.clients.PantryClient.bulk_add_items", new_callable=AsyncMock)
async def test_sync_to_pantry_flow_and_history_logging(mock_bulk_add: AsyncMock, client: AsyncClient, db_session: AsyncSession):
    # Setup list and items
    l1 = ShoppingList(name="Sync Test List", home_id=MOCK_HOME_ID, owner_id=MOCK_USER_ID)
    db_session.add(l1)
    await db_session.commit()
    await db_session.refresh(l1)

    item1 = ShoppingItem(
        list_id=l1.id,
        name="Basmati Rice",
        barcode="4000333333333",
        quantity=1500.0,
        unit="g",
        is_completed=True,  # Ready to sync
        is_synced=False,
    )
    item2 = ShoppingItem(
        list_id=l1.id,
        name="Wild Berries",
        barcode=None,
        quantity=2.0,
        unit="pack",
        is_completed=True,  # Ready to sync
        is_synced=False,
    )
    db_session.add(item1)
    db_session.add(item2)
    await db_session.commit()
    await db_session.refresh(item1)
    await db_session.refresh(item2)

    # Mock Pantry Bulk-Add response (Berries unrecognized)
    mock_bulk_add.return_value = {
        "successful_items": [
            {
                "shopping_item_id": str(item1.id),
                "product_id": "e67d26bb-8888-4db9-8eb2-b8ee4d2e7ff2",
                "quantity_added": 1500.0,
                "unit": "g",
            }
        ],
        "unrecognized_items": [
            {
                "shopping_item_id": str(item2.id),
                "name": "Wild Berries",
                "brand": None,
                "barcode": None,
                "quantity": 2.0,
                "unit": "pack",
                "reason": "pantry.error.product_not_found",
            }
        ]
    }

    # Trigger Sync to Pantry
    response = await client.post(f"/api/v1/shopping-lists/{l1.id}/sync-to-pantry")
    assert response.status_code == 200
    sync_data = response.json()

    assert sync_data["status"] == "partial_success"
    assert sync_data["synced_count"] == 1
    assert sync_data["unrecognized_count"] == 1
    assert sync_data["unrecognized_items"][0]["shopping_item_id"] == str(item2.id)

    # Verify states in Shopping DB
    db_item1 = (await db_session.exec(select(ShoppingItem).where(ShoppingItem.id == item1.id))).one()
    assert db_item1.is_synced is True
    assert db_item1.product_id == uuid.UUID("e67d26bb-8888-4db9-8eb2-b8ee4d2e7ff2")

    db_item2 = (await db_session.exec(select(ShoppingItem).where(ShoppingItem.id == item2.id))).one()
    assert db_item2.is_synced is False  # Remained unsynced for manual frontend resolution

    # Verify ShoppingHistory logged both items
    history_res = await db_session.exec(select(ShoppingHistory))
    histories = history_res.all()
    assert len(histories) == 2

    rice_hist = next(x for x in histories if x.name == "Basmati Rice")
    assert rice_hist.purchase_count == 1
    assert rice_hist.unit == "g"

    berries_hist = next(x for x in histories if x.name == "Wild Berries")
    assert berries_hist.purchase_count == 1
    assert berries_hist.brand == ""  # Normalized to empty string

    # Verify Quick selection search history GET route
    history_response = await client.get("/api/v1/shopping-history")
    assert history_response.status_code == 200
    history_data = history_response.json()
    assert len(history_data) == 2
    assert history_data[0]["purchase_count"] == 1

    # Assert Bring-Style selection history upserts (purchasing Rice again)
    # Reset completion status of rice for a second run
    db_item1.is_completed = True
    db_item1.is_synced = False
    db_session.add(db_item1)
    await db_session.commit()

    # Mock Pantry Bulk-Add response for second run
    mock_bulk_add.return_value = {
        "successful_items": [
            {
                "shopping_item_id": str(db_item1.id),
                "product_id": "e67d26bb-8888-4db9-8eb2-b8ee4d2e7ff2",
                "quantity_added": 1500.0,
                "unit": "g",
            }
        ],
        "unrecognized_items": []
    }

    # Trigger second sync
    response = await client.post(f"/api/v1/shopping-lists/{l1.id}/sync-to-pantry")
    assert response.status_code == 200

    # Verify purchase_count incremented to 2 for Basmati Rice (upserted, not duplicated)
    history_res = await db_session.exec(select(ShoppingHistory))
    histories = history_res.all()
    assert len(histories) == 2  # Still 2 items in history total

    rice_hist = next(x for x in histories if x.name == "Basmati Rice")
    assert rice_hist.purchase_count == 2
