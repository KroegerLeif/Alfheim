from unittest.mock import AsyncMock, MagicMock

import pytest
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
