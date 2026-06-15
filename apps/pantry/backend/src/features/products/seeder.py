import json
import pathlib
import uuid
import anyio
from pydantic import TypeAdapter
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.products.models import Product
from src.features.products.schemas import ProductCreate
from src.features.products.service import ProductService


async def seed_default_products(session: AsyncSession) -> None:
    """Ensure standard system-level global products exist.

    Loads and validates products dynamically from default_products.json on application startup.
    """
    config_path = anyio.Path(pathlib.Path(__file__).parent / "default_products.json")
    if not await config_path.exists():
        return

    try:
        content = await config_path.read_text()
        raw_data = json.loads(content)
        # Strictly validate products using Pydantic's TypeAdapter
        ta = TypeAdapter(list[ProductCreate])
        default_products = ta.validate_python(raw_data)
    except Exception as e:
        print(f"Failed to load or validate default products config: {e}")
        return

    # Seed products if they do not exist already
    for item in default_products:
        if not item.barcode:
            continue

        stmt = select(Product).where(Product.barcode == item.barcode, Product.is_global)
        res = await session.exec(stmt)
        if not res.first():
            try:
                # Set is_global to True; home_id is ignored internally in ProductService
                await ProductService.create_product(
                    session=session,
                    payload=item,
                    home_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
                    is_global=True,
                )
            except ValueError as e:
                print(f"Seeder failed to insert product '{item.name}': {e}")
