import json
import pathlib

import anyio
from pydantic import BaseModel, TypeAdapter
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.dependencies import MOCK_HOME_ID
from src.features.inventory.models import InventoryState, InventoryTransactionType
from src.features.inventory.schemas import InventoryTransactionCreate
from src.features.inventory.service import InventoryService
from src.features.locations.models import Location
from src.features.products.models import Product


class InventorySeedItem(BaseModel):
    """Schema for validating raw inventory seed configuration items."""

    product_barcode: str
    location_name: str
    quantity_input: float
    unit_input: str
    notes: str = "Seeded initial stock"


async def seed_default_inventory(session: AsyncSession) -> None:
    """Ensure default inventory levels exist for seeded products and locations.

    Loads inventory seed configuration dynamically from default_inventory.json.
    Processes transaction creation through InventoryService to preserve audit logs.
    """
    config_path = anyio.Path(pathlib.Path(__file__).parent / "default_inventory.json")
    if not await config_path.exists():
        return

    try:
        content = await config_path.read_text()
        raw_data = json.loads(content)
        ta = TypeAdapter(list[InventorySeedItem])
        seed_items = ta.validate_python(raw_data)
    except Exception as e:
        print(f"Failed to load or validate default inventory config: {e}")
        return

    for item in seed_items:
        # 1. Resolve Product by barcode
        prod_stmt = select(Product).where(Product.barcode == item.product_barcode)
        prod_res = await session.exec(prod_stmt)
        product = prod_res.first()
        if not product:
            print(f"Inventory seeder: product with barcode '{item.product_barcode}' not found. Skipping.")
            continue

        # 2. Resolve Location by name and MOCK_HOME_ID
        loc_stmt = select(Location).where(
            Location.name == item.location_name,
            Location.home_id == MOCK_HOME_ID,
        )
        loc_res = await session.exec(loc_stmt)
        location = loc_res.first()
        if not location:
            print(f"Inventory seeder: location '{item.location_name}' not found for mock home space. Skipping.")
            continue

        # 3. Check if inventory state already exists to ensure idempotence
        # If there's already ANY stock for this product in this location, skip seeding to avoid double-adding.
        state_stmt = select(InventoryState).where(
            InventoryState.product_id == product.id,
            InventoryState.location_id == location.id,
        )
        state_res = await session.exec(state_stmt)
        if state_res.first():
            # Already seeded or has stock, skip to prevent duplicate accumulation
            continue

        # 4. Generate seeding transaction (type "in")
        payload = InventoryTransactionCreate(
            product_id=product.id,
            location_id=location.id,
            transaction_type=InventoryTransactionType.IN,
            quantity_input=item.quantity_input,
            unit_input=item.unit_input,
            batch_code=None,
            expiration_date=None,
            notes=item.notes,
        )

        try:
            await InventoryService.create_transaction(
                session=session,
                payload=payload,
                home_id=MOCK_HOME_ID,
            )
        except Exception as e:
            print(f"Inventory seeder failed to seed product '{product.name}' in location '{location.name}': {e}")
