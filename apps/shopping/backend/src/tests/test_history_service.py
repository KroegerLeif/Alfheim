import uuid

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.history.service import ShoppingHistoryService


@pytest.fixture
def sample_home_id() -> uuid.UUID:
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


async def test_log_purchase_create_and_increment(db_session: AsyncSession, sample_home_id: uuid.UUID):
    """Test logging a purchase creates a new record and subsequent log increments purchase_count."""
    # First purchase log
    history_1 = await ShoppingHistoryService.log_purchase(
        session=db_session,
        home_id=sample_home_id,
        name="Oat Milk",
        brand="Oatly",
        barcode="12345678",
        unit="ml",
    )
    await db_session.commit()

    assert history_1.id is not None
    assert history_1.name == "Oat Milk"
    assert history_1.brand == "Oatly"
    assert history_1.purchase_count == 1
    assert history_1.icon_tag == "icon.grocery.milk"

    # Second purchase log for same item
    history_2 = await ShoppingHistoryService.log_purchase(
        session=db_session,
        home_id=sample_home_id,
        name="Oat Milk",
        brand="Oatly",
        barcode="12345678",
        unit="ml",
    )
    await db_session.commit()

    assert history_2.id == history_1.id
    assert history_2.purchase_count == 2


async def test_get_history(db_session: AsyncSession, sample_home_id: uuid.UUID):
    """Test retrieving history sorted by purchase count."""
    await ShoppingHistoryService.log_purchase(db_session, sample_home_id, "Bread", brand="Bakery", unit="g")
    await ShoppingHistoryService.log_purchase(db_session, sample_home_id, "Apple", brand="", unit="piece")
    await ShoppingHistoryService.log_purchase(db_session, sample_home_id, "Apple", brand="", unit="piece")
    await db_session.commit()

    history = await ShoppingHistoryService.get_history(db_session, sample_home_id)
    assert len(history) == 2
    assert history[0].name == "Apple"  # Higher purchase count (2)
    assert history[0].purchase_count == 2
    assert history[1].name == "Bread"  # Lower purchase count (1)


async def test_delete_history_item(db_session: AsyncSession, sample_home_id: uuid.UUID):
    """Test deleting an item from history."""
    history_item = await ShoppingHistoryService.log_purchase(db_session, sample_home_id, "Käse", brand="Bio", unit="g")
    await db_session.commit()

    # Delete existing item
    success = await ShoppingHistoryService.delete_history_item(db_session, history_item.id, sample_home_id)
    assert success is True

    # Confirm item deleted
    remaining = await ShoppingHistoryService.get_history(db_session, sample_home_id)
    assert len(remaining) == 0

    # Delete non-existent item
    fake_id = uuid.uuid4()
    success_fake = await ShoppingHistoryService.delete_history_item(db_session, fake_id, sample_home_id)
    assert success_fake is False


def test_resolve_icon_tag():
    """Test icon tag resolution based on product name keywords."""
    assert ShoppingHistoryService.resolve_icon_tag("Fresh Milk 3.5%") == "icon.grocery.milk"
    assert ShoppingHistoryService.resolve_icon_tag("Gouda Käse") == "icon.grocery.cheese"
    assert ShoppingHistoryService.resolve_icon_tag("Mineralwasser") == "icon.grocery.drinks"
    assert ShoppingHistoryService.resolve_icon_tag("Unknown Commodity") == "icon.grocery.default"
