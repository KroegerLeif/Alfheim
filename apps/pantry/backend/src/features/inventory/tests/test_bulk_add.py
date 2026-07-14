import uuid
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.locations.models import Location
from src.features.products.models import Product, BaseUnit
from src.features.inventory.models import InventoryState


@pytest.fixture(autouse=True)
async def seed_locations(db_session: AsyncSession):
    """Seed the default system locations like Backlog before tests."""
    from src.features.locations.seeder import seed_default_locations
    await seed_default_locations(db_session)
    await db_session.commit()


@pytest.mark.asyncio
async def test_bulk_add_success(client: AsyncClient, db_session: AsyncSession):
    # 1. Setup products in DB
    p1 = Product(
        name="Apple Juice",
        barcode="4000111222333",
        base_unit=BaseUnit.ML,
        is_global=True,
    )
    p2 = Product(
        name="Basmati Rice",
        barcode=None,
        base_unit=BaseUnit.G,
        is_global=True,
    )
    db_session.add(p1)
    db_session.add(p2)
    await db_session.commit()

    # 2. Setup bulk add payload
    item1_id = uuid.uuid4()
    item2_id = uuid.uuid4()
    item3_id = uuid.uuid4()
    payload = {
        "items": [
            {
                "shopping_item_id": str(item1_id),
                "name": "Apple Juice",
                "brand": "Brand A",
                "barcode": "4000111222333",  # Match by barcode
                "quantity": 500,
                "unit": "ml",
            },
            {
                "shopping_item_id": str(item2_id),
                "name": "Basmati Rice",  # Match by name (case-insensitive)
                "brand": None,
                "barcode": None,
                "quantity": 1,
                "unit": "kg",  # Unit conversion (kg -> g)
            },
            {
                "shopping_item_id": str(item3_id),
                "name": "Unrecognized Banana",
                "brand": "Banana Inc",
                "barcode": None,
                "quantity": 3,
                "unit": "piece",
            }
        ]
    }

    # 3. Post to the bulk-add endpoint
    response = await client.post("/api/v1/inventory/bulk-add", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "successful_items" in data
    assert "unrecognized_items" in data

    # 4. Verify Successful items
    success = data["successful_items"]
    assert len(success) == 2

    # Verify juice
    juice_success = next(x for x in success if x["shopping_item_id"] == str(item1_id))
    assert juice_success["product_id"] == str(p1.id)
    assert juice_success["quantity_added"] == 500.0
    assert juice_success["unit"] == "ml"

    # Verify rice
    rice_success = next(x for x in success if x["shopping_item_id"] == str(item2_id))
    assert rice_success["product_id"] == str(p2.id)
    assert rice_success["quantity_added"] == 1.0
    assert rice_success["unit"] == "kg"

    # 5. Verify Unrecognized banana
    unrecognized = data["unrecognized_items"]
    assert len(unrecognized) == 1
    assert unrecognized[0]["shopping_item_id"] == str(item3_id)
    assert unrecognized[0]["name"] == "Unrecognized Banana"
    assert unrecognized[0]["reason"] == "pantry.error.product_not_found"

    # 6. Verify inventory states reflect additions
    juice_state_stmt = select(InventoryState).where(InventoryState.product_id == p1.id)
    juice_state = (await db_session.exec(juice_state_stmt)).one()
    assert juice_state.quantity == 500.0  # Added 500 ml

    rice_state_stmt = select(InventoryState).where(InventoryState.product_id == p2.id)
    rice_state = (await db_session.exec(rice_state_stmt)).one()
    assert rice_state.quantity == 1000.0  # Added 1 kg = 1000 g


@pytest.mark.asyncio
async def test_bulk_add_incompatible_unit(client: AsyncClient, db_session: AsyncSession):
    # Setup product
    p = Product(
        name="Flour",
        barcode="4000999999999",
        base_unit=BaseUnit.G,
        is_global=True,
    )
    db_session.add(p)
    await db_session.commit()

    item_id = uuid.uuid4()
    payload = {
        "items": [
            {
                "shopping_item_id": str(item_id),
                "name": "Flour",
                "brand": None,
                "barcode": "4000999999999",
                "quantity": 2,
                "unit": "ml",  # ml is incompatible with g (mass vs volume)
            }
        ]
    }

    response = await client.post("/api/v1/inventory/bulk-add", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["successful_items"]) == 0
    assert len(data["unrecognized_items"]) == 1
    assert data["unrecognized_items"][0]["shopping_item_id"] == str(item_id)
    assert data["unrecognized_items"][0]["reason"] == "pantry.error.incompatible_units"


@pytest.mark.asyncio
async def test_bulk_add_invalid_unit_string(client: AsyncClient, db_session: AsyncSession):
    # Setup product
    p = Product(
        name="Sugar",
        barcode="4000888888888",
        base_unit=BaseUnit.G,
        is_global=True,
    )
    db_session.add(p)
    await db_session.commit()

    item_id = uuid.uuid4()
    payload = {
        "items": [
            {
                "shopping_item_id": str(item_id),
                "name": "Sugar",
                "brand": None,
                "barcode": "4000888888888",
                "quantity": 1,
                "unit": "crazy-unit-that-does-not-exist",
            }
        ]
    }

    response = await client.post("/api/v1/inventory/bulk-add", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["successful_items"]) == 0
    assert len(data["unrecognized_items"]) == 1
    assert data["unrecognized_items"][0]["shopping_item_id"] == str(item_id)
    assert data["unrecognized_items"][0]["reason"] == "pantry.error.invalid_unit"
