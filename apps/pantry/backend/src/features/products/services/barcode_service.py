import uuid

from sqlmodel import select
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
        # 1. Household's own product first, then the shared catalog (Open Food Facts imports).
        #    Other households' local products are never visible.
        own_stmt = select(Product).where(Product.barcode == barcode, Product.home_id == home_id)
        own_product = (await session.exec(own_stmt)).first()
        if own_product:
            return own_product

        global_stmt = select(Product).where(Product.barcode == barcode, Product.is_global)
        global_product = (await session.exec(global_stmt)).first()
        if global_product:
            return global_product

        # 2. External lookup via Open Food Facts Client
        if off_client is None:
            return None

        external_payload = await off_client.get_by_barcode(barcode)
        if not external_payload:
            return None

        # 3. Auto-ingest as global product transactionally
        try:
            return await ProductCrudService.create_product(
                session=session,
                payload=external_payload,
                home_id=home_id,
                is_global=True,  # Shared system-wide
            )
        except ValueError:
            # Handle race condition where another request created the product concurrently
            return (await session.exec(global_stmt)).first()
