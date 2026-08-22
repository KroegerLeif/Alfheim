import uuid

from sqlalchemy.exc import IntegrityError
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.products.models import Product, ProductNutrition
from src.features.products.schemas import ProductNutritionUpdate
from src.features.products.services.product_crud_service import ProductCrudService


class ProductNutritionService:
    """Service class encapsulating product nutrition operations."""

    @staticmethod
    async def get_product_nutrition(
        session: AsyncSession,
        product_id: uuid.UUID | str,
        home_id: uuid.UUID,
    ) -> ProductNutrition | None:
        """Retrieve the isolated nutrition profile of a product if authorized."""
        prod_uuid = uuid.UUID(product_id) if isinstance(product_id, str) else product_id
        # Join Product to enforce home isolation boundary on nutrition queries
        statement = (
            select(ProductNutrition)
            .join(Product)
            .where(
                ProductNutrition.product_id == prod_uuid,
                or_(Product.is_global, Product.home_id == home_id),
            )
        )
        result = await session.exec(statement)
        return result.first()

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
        """Update or create the nutrition profile of an existing product.

        Global products cannot be modified.
        """
        prod_uuid = uuid.UUID(product_id) if isinstance(product_id, str) else product_id
        product = await ProductCrudService.get_product(session, prod_uuid, home_id)
        if not product:
            return None

        if product.is_global:
            raise ValueError("Global product nutrition cannot be modified.")

        if payload is None:
            update_data = {}
            if calories is not None:
                update_data["calories"] = calories
            if fat is not None:
                update_data["fat"] = fat
            if saturated_fat is not None:
                update_data["saturated_fat"] = saturated_fat
            if carbohydrates is not None:
                update_data["carbohydrates"] = carbohydrates
            if sugars is not None:
                update_data["sugars"] = sugars
            if protein is not None:
                update_data["protein"] = protein
            if salt is not None:
                update_data["salt"] = salt
        else:
            update_data = payload.model_dump(exclude_unset=True)

        nutrition = await ProductNutritionService.get_product_nutrition(session, prod_uuid, home_id)

        if not nutrition:
            # Create new nutrition entry if it didn't exist
            nutrition = ProductNutrition(product_id=prod_uuid, **update_data)
            session.add(nutrition)
        else:
            # Update existing nutrition entry
            for key, value in update_data.items():
                setattr(nutrition, key, value)
            session.add(nutrition)

        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Database error during nutrition update: {e}") from e

        await session.refresh(nutrition)
        return nutrition
