import uuid

from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.products.clients.open_food_facts import OpenFoodFactsClient
from src.features.products.models import Product
from src.features.products.services.product_crud_service import ProductCrudService


class BarcodeService:
    """Service class encapsulating product barcode lookup and OpenFoodFacts external sync."""

    @staticmethod
    async def get_or_create_by_barcode(
        session: AsyncSession,
        barcode: str,
        home_id: uuid.UUID,
        off_client: OpenFoodFactsClient | None = None,
    ) -> Product | None:
        """Look up a product locally by barcode.

        If not found, queries Open Food Facts Client, auto-seeds the database,
        and returns the newly cached product.
        """
        # 1. Local Database Lookup (including global and home-local catalogs)
        statement = select(Product).where(
            Product.barcode == barcode,
            or_(Product.is_global, Product.home_id == home_id),
        )
        result = await session.exec(statement)
        local_product = result.first()
        if local_product:
            return local_product

        # 2. Check for global clash (barcode exists under a different home space)
        global_check_stmt = select(Product).where(Product.barcode == barcode)
        global_check_res = await session.exec(global_check_stmt)
        if global_check_res.first():
            # Barcode is registered by another home; we cannot auto-ingest or expose it
            return None

        # 3. External lookup via Open Food Facts Client
        if off_client is None:
            return None

        external_payload = await off_client.get_by_barcode(barcode)
        if not external_payload:
            return None

        # 4. Auto-ingest as global product transactionally
        try:
            return await ProductCrudService.create_product(
                session=session,
                payload=external_payload,
                home_id=home_id,
                is_global=True,  # Shared system-wide
            )
        except ValueError:
            # Handle race condition where another request created the product concurrently
            result = await session.exec(statement)
            return result.first()
