"""Facade over the product CRUD, nutrition and barcode services."""

import uuid
from collections.abc import Sequence

from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.products.clients.open_food_facts import OpenFoodFactsClient
from src.features.products.models import Product, ProductNutrition
from src.features.products.schemas import (
    ProductCreate,
    ProductNutritionUpdate,
    ProductUpdate,
)
from src.features.products.services.barcode_service import BarcodeService
from src.features.products.services.nutrition_service import ProductNutritionService
from src.features.products.services.product_crud_service import ProductCrudService


class ProductService:
    """Service class encapsulating async database operations for Products.

    Delegates responsibilities to ProductCrudService, ProductNutritionService,
    and BarcodeService.
    """

    @staticmethod
    async def create_product(
        session: AsyncSession,
        home_id: uuid.UUID,
        payload: ProductCreate | None = None,
        is_global: bool = False,
        *,
        name: str | None = None,
        base_unit: str | None = None,
        brand: str | None = None,
        barcode: str | None = None,
        category_id: uuid.UUID | str | None = None,
        image_url: str | None = None,
        minimum_stock: float = 0.0,
        calories: float | None = None,
        fat: float | None = None,
        saturated_fat: float | None = None,
        carbohydrates: float | None = None,
        sugars: float | None = None,
        protein: float | None = None,
        salt: float | None = None,
    ) -> Product:
        """Create a product in the household; see ``ProductCrudService.create_product``."""
        return await ProductCrudService.create_product(
            session=session,
            payload=payload,
            home_id=home_id,
            is_global=is_global,
            name=name,
            base_unit=base_unit,
            brand=brand,
            barcode=barcode,
            category_id=category_id,
            image_url=image_url,
            minimum_stock=minimum_stock,
            calories=calories,
            fat=fat,
            saturated_fat=saturated_fat,
            carbohydrates=carbohydrates,
            sugars=sugars,
            protein=protein,
            salt=salt,
        )

    @staticmethod
    async def get_product(
        session: AsyncSession,
        product_id: uuid.UUID | str,
        home_id: uuid.UUID,
    ) -> Product | None:
        """Return a product if it is global or belongs to the household, else ``None``."""
        return await ProductCrudService.get_product(session, product_id, home_id)

    @staticmethod
    async def get_product_nutrition(
        session: AsyncSession,
        product_id: uuid.UUID | str,
        home_id: uuid.UUID,
    ) -> ProductNutrition | None:
        """Return the nutrition profile of a product visible to the household, else ``None``."""
        return await ProductNutritionService.get_product_nutrition(session, product_id, home_id)

    @staticmethod
    async def get_or_create_by_barcode(
        session: AsyncSession,
        barcode: str,
        home_id: uuid.UUID,
        off_client: OpenFoodFactsClient | None = None,
    ) -> Product | None:
        """Find a product by barcode, importing it from Open Food Facts on a local miss."""
        return await BarcodeService.get_or_create_by_barcode(session, barcode, home_id, off_client)

    @staticmethod
    async def list_products(
        session: AsyncSession,
        home_id: uuid.UUID,
        name: str | None = None,
        barcode: str | None = None,
        category_id: uuid.UUID | str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Product]:
        """List and search products visible to the household (global plus household-local)."""
        return await ProductCrudService.list_products(
            session, home_id, name=name, barcode=barcode, category_id=category_id, limit=limit, offset=offset
        )

    @staticmethod
    async def update_product(
        session: AsyncSession,
        product_id: uuid.UUID | str,
        home_id: uuid.UUID,
        payload: ProductUpdate | None = None,
        *,
        name: str | None = None,
        brand: str | None = None,
        barcode: str | None = None,
        category_id: uuid.UUID | str | None = None,
        image_url: str | None = None,
        base_unit: str | None = None,
        minimum_stock: float | None = None,
    ) -> Product | None:
        """Partially update a household-local product; global products cannot be modified."""
        return await ProductCrudService.update_product(
            session,
            product_id,
            home_id,
            payload=payload,
            name=name,
            brand=brand,
            barcode=barcode,
            category_id=category_id,
            image_url=image_url,
            base_unit=base_unit,
            minimum_stock=minimum_stock,
        )

    @staticmethod
    async def update_product_nutrition(
        session: AsyncSession,
        product_id: uuid.UUID | str,
        home_id: uuid.UUID,
        payload: ProductNutritionUpdate | None = None,
        *,
        calories: float | None = None,
        fat: float | None = None,
        saturated_fat: float | None = None,
        carbohydrates: float | None = None,
        sugars: float | None = None,
        protein: float | None = None,
        salt: float | None = None,
    ) -> ProductNutrition | None:
        """Create or update the nutrition profile of a household-local product."""
        return await ProductNutritionService.update_product_nutrition(
            session,
            product_id,
            home_id,
            payload=payload,
            calories=calories,
            fat=fat,
            saturated_fat=saturated_fat,
            carbohydrates=carbohydrates,
            sugars=sugars,
            protein=protein,
            salt=salt,
        )

    @staticmethod
    async def delete_product(
        session: AsyncSession,
        product_id: uuid.UUID | str,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a household-local product; refused while it still has stock or ledger history."""
        return await ProductCrudService.delete_product(session, product_id, home_id)
