import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID, MOCK_USER_ID
from src.features.shopping_lists.models import ShoppingItem, ShoppingList
from src.features.shopping_lists.services.pantry_sync_service import PantrySyncService


@pytest.mark.asyncio
async def test_pantry_sync_service_auto_import_empty(db_session: AsyncSession):
    l1 = ShoppingList(name="Test List", home_id=MOCK_HOME_ID, owner_id=MOCK_USER_ID)
    db_session.add(l1)
    await db_session.commit()
    await db_session.refresh(l1)

    mock_client = MagicMock()
    mock_client.fetch_low_stock_items = AsyncMock(return_value=[])

    imported = await PantrySyncService.auto_import_low_stock(
        session=db_session,
        list_id=l1.id,
        home_id=MOCK_HOME_ID,
        pantry_client=mock_client,
    )
    assert len(imported) == 0


@pytest.mark.asyncio
async def test_pantry_sync_service_sync_to_pantry_no_completed(db_session: AsyncSession):
    l1 = ShoppingList(name="Test List 2", home_id=MOCK_HOME_ID, owner_id=MOCK_USER_ID)
    db_session.add(l1)
    await db_session.commit()
    await db_session.refresh(l1)

    item = ShoppingItem(
        list_id=l1.id,
        name="Butter",
        quantity=1.0,
        unit="pack",
        is_completed=False,
    )
    db_session.add(item)
    await db_session.commit()

    res = await PantrySyncService.sync_to_pantry(
        session=db_session,
        list_id=l1.id,
        home_id=MOCK_HOME_ID,
    )
    assert res.status == "success"
    assert res.synced_count == 0
    assert res.unrecognized_count == 0


@pytest.mark.asyncio
async def test_pantry_sync_service_auto_import_low_stock_merges_and_quantities(db_session: AsyncSession):
    l1 = ShoppingList(name="Test List 3", home_id=MOCK_HOME_ID, owner_id=MOCK_USER_ID)
    db_session.add(l1)
    await db_session.commit()
    await db_session.refresh(l1)

    active_barcode = ShoppingItem(
        list_id=l1.id, name="Apple", barcode="12345", quantity=1.0, unit="piece", is_completed=False
    )
    active_name = ShoppingItem(list_id=l1.id, name="Banana", quantity=1.0, unit="piece", is_completed=False)
    db_session.add(active_barcode)
    db_session.add(active_name)
    await db_session.commit()

    imported_product_id = uuid.uuid4()
    mock_client = MagicMock()
    mock_client.fetch_low_stock_items = AsyncMock(
        return_value=[
            {
                "current_stock": 0.0,
                "product": {"id": str(uuid.uuid4()), "name": "Apple new", "barcode": "12345", "minimum_stock": 2.0},
            },
            {
                "current_stock": 0.0,
                "product": {"id": str(uuid.uuid4()), "name": " banana ", "minimum_stock": 2.0},
            },
            {
                "current_stock": 2.0,
                "product": {
                    "id": str(imported_product_id),
                    "name": "Milk",
                    "brand": "Local",
                    "minimum_stock": 5.0,
                    "base_unit": "l",
                },
            },
            {
                "current_stock": 4.0,
                "product": {"id": str(uuid.uuid4()), "name": "Bread", "minimum_stock": 1.0, "base_unit": "piece"},
            },
        ]
    )

    imported = await PantrySyncService.auto_import_low_stock(
        session=db_session,
        list_id=l1.id,
        home_id=MOCK_HOME_ID,
        pantry_client=mock_client,
    )

    assert len(imported) == 2
    imported_by_name = {item.name: item for item in imported}

    assert imported_by_name["Milk"].quantity == 3.0
    assert imported_by_name["Milk"].product_id == imported_product_id
    assert imported_by_name["Milk"].is_auto_generated is True
    assert imported_by_name["Bread"].quantity == 1.0
    assert imported_by_name["Bread"].is_auto_generated is True

    all_items_res = await db_session.exec(select(ShoppingItem).where(ShoppingItem.list_id == l1.id))
    all_items = all_items_res.all()
    assert len(all_items) == 4


@pytest.mark.asyncio
async def test_pantry_sync_service_sync_to_pantry_updates_success_and_unrecognized(db_session: AsyncSession):
    l1 = ShoppingList(name="Test List 4", home_id=MOCK_HOME_ID, owner_id=MOCK_USER_ID)
    db_session.add(l1)
    await db_session.commit()
    await db_session.refresh(l1)

    synced_item = ShoppingItem(
        list_id=l1.id, name="Milk", quantity=1.0, unit="piece", is_completed=True, is_synced=False
    )
    unsynced_item = ShoppingItem(
        list_id=l1.id, name="Butter", quantity=2.0, unit="pack", is_completed=True, is_synced=False
    )
    db_session.add(synced_item)
    db_session.add(unsynced_item)
    await db_session.commit()
    await db_session.refresh(synced_item)
    await db_session.refresh(unsynced_item)

    pantry_product_id = uuid.uuid4()
    mock_client = MagicMock()
    mock_client.bulk_add_items = AsyncMock(
        return_value={
            "successful_items": [{"shopping_item_id": str(synced_item.id), "product_id": str(pantry_product_id)}],
            "unrecognized_items": [
                {
                    "shopping_item_id": str(unsynced_item.id),
                    "name": unsynced_item.name,
                    "brand": None,
                    "barcode": None,
                    "quantity": unsynced_item.quantity,
                    "unit": unsynced_item.unit,
                    "reason": "pantry.error.product_not_found",
                }
            ],
        }
    )

    with patch(
        "src.features.shopping_lists.services.pantry_sync_service.ShoppingHistoryService.log_purchase", new=AsyncMock()
    ) as log_purchase:
        res = await PantrySyncService.sync_to_pantry(
            session=db_session,
            list_id=l1.id,
            home_id=MOCK_HOME_ID,
            pantry_client=mock_client,
        )

    await db_session.refresh(synced_item)
    await db_session.refresh(unsynced_item)

    assert res.status == "partial_success"
    assert res.synced_count == 1
    assert res.unrecognized_count == 1
    assert res.unrecognized_items[0].shopping_item_id == unsynced_item.id

    assert synced_item.is_synced is True
    assert synced_item.product_id == pantry_product_id
    assert unsynced_item.is_synced is False
    assert unsynced_item.product_id is None

    assert log_purchase.await_count == 2
