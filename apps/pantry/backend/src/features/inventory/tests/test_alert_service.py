import uuid
from datetime import date, timedelta

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID
from src.features.inventory.alert_service import AlertService
from src.features.inventory.models import InventoryState
from src.features.locations.models import Location
from src.features.products.models import Product


@pytest.fixture(autouse=True)
async def seed_alert_service_data(db_session: AsyncSession):
    """Seed locations, products, and default inventory for alert service tests."""
    from src.features.inventory.seeder import seed_default_inventory
    from src.features.locations.seeder import seed_default_locations
    from src.features.products.seeder import seed_default_products

    await seed_default_locations(db_session)
    await seed_default_products(db_session)
    await seed_default_inventory(db_session)
    await db_session.commit()


@pytest.mark.asyncio
async def test_alert_service_get_low_stock_items(db_session: AsyncSession):
    """Only the caller household's own products are evaluated; shared catalog rows never alert."""
    spag_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = spag_res.one()
    assert spaghetti.is_global
    spaghetti.minimum_stock = 1000.0

    own = Product(name="Own Low", base_unit="piece", minimum_stock=5.0, home_id=MOCK_HOME_ID)
    other_home = Product(name="Other Low", base_unit="piece", minimum_stock=5.0, home_id=uuid.uuid4())
    db_session.add_all([own, other_home])
    await db_session.commit()

    low_stock = await AlertService.get_low_stock_items(
        session=db_session,
        home_id=MOCK_HOME_ID,
    )

    low_stock_product_ids = [item["product"].id for item in low_stock]
    assert own.id in low_stock_product_ids
    assert spaghetti.id not in low_stock_product_ids
    assert other_home.id not in low_stock_product_ids


@pytest.mark.asyncio
async def test_alert_service_get_expiration_summary(db_session: AsyncSession):
    """Verify AlertService.get_expiration_summary categorizes expired, valid, and untracked items."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    # Clear existing states for clean test
    existing = await db_session.exec(select(InventoryState))
    for st in existing.all():
        await db_session.delete(st)
    await db_session.commit()

    expired_state = InventoryState(
        product_id=spaghetti.id,
        location_id=backlog.id,
        quantity=100.0,
        expiration_date=date.today() - timedelta(days=2),
    )
    valid_state = InventoryState(
        product_id=spaghetti.id,
        location_id=backlog.id,
        quantity=200.0,
        expiration_date=date.today() + timedelta(days=10),
    )
    db_session.add(expired_state)
    db_session.add(valid_state)
    await db_session.commit()

    summary = await AlertService.get_expiration_summary(
        session=db_session,
        home_id=MOCK_HOME_ID,
    )

    assert len(summary["expired"]) == 1
    assert len(summary["valid"]) == 1
    assert summary["expired"][0].quantity == 100.0
    assert summary["valid"][0].quantity == 200.0
