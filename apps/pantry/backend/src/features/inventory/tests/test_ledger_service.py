import uuid

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID
from src.features.inventory.ledger_service import LedgerService
from src.features.inventory.models import InventoryTransactionType
from src.features.inventory.schemas import InventoryTransactionCreate
from src.features.inventory.service import InventoryService
from src.features.locations.models import Location
from src.features.products.models import Product


@pytest.fixture(autouse=True)
async def seed_ledger_service_data(db_session: AsyncSession):
    """Seed default locations and products for ledger service tests."""
    from src.features.inventory.seeder import seed_default_inventory
    from src.features.locations.seeder import seed_default_locations
    from src.features.products.seeder import seed_default_products

    await seed_default_locations(db_session)
    await seed_default_products(db_session)
    await seed_default_inventory(db_session)
    await db_session.commit()


@pytest.mark.asyncio
async def test_ledger_service_get_history_direct(db_session: AsyncSession):
    """Verify LedgerService.get_ledger_history retrieves transaction logs correctly."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    # Record a transaction
    tx_payload = InventoryTransactionCreate(
        product_id=spaghetti.id,
        location_id=backlog.id,
        transaction_type=InventoryTransactionType.IN,
        quantity_input=250.0,
        unit_input="g",
        notes="Ledger service test transaction",
    )
    tx = await InventoryService.create_transaction(
        session=db_session,
        payload=tx_payload,
        home_id=MOCK_HOME_ID,
    )

    # Directly test LedgerService
    history = await LedgerService.get_ledger_history(
        session=db_session,
        home_id=MOCK_HOME_ID,
        product_id=spaghetti.id,
    )

    assert len(history) >= 1
    latest_entry = history[0]
    assert latest_entry.id == tx.id
    assert latest_entry.quantity_input == 250.0
    assert latest_entry.notes == "Ledger service test transaction"


@pytest.mark.asyncio
async def test_ledger_service_isolation(db_session: AsyncSession):
    """Verify LedgerService filters entries by household ID boundary."""
    other_home_id = uuid.uuid4()
    history_other_home = await LedgerService.get_ledger_history(
        session=db_session,
        home_id=other_home_id,
    )
    assert len(history_other_home) == 0
