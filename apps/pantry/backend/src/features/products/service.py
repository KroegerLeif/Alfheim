import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import col, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.products.clients.open_food_facts import OpenFoodFactsClient
from src.features.products.models import Product, ProductNutrition
from src.features.products.schemas import ProductCreate, ProductNutritionUpdate, ProductUpdate


class ProductService:
    """Service class encapsulating async database operations for Products."""

    @staticmethod
    async def create_product(
        session: AsyncSession,
        payload: ProductCreate,
        home_id: uuid.UUID,
        is_global: bool = False,
    ) -> Product:
        """Create a new product blueprint.

        Enforces global barcode uniqueness and writes both product and nutrition
        profile in a single ACID transaction.
        """
        # 1. Barcode uniqueness pre-check & global promotion logic
        if payload.barcode and len(payload.barcode.strip()) > 0:
            barcode_stmt = select(Product).where(Product.barcode == payload.barcode)
            barcode_res = await session.exec(barcode_stmt)
            if barcode_res.first():
                raise ValueError(f"Product with barcode '{payload.barcode}' already exists.")
            # Products with valid barcodes are promoted globally to prevent collisions
            is_global = True

        # 2. Category boundary check
        if payload.category_id:
            from src.features.categories.models import Category

            category_stmt = select(Category).where(Category.id == payload.category_id)
            if not is_global:
                category_stmt = category_stmt.where(or_(Category.is_global, Category.home_id == home_id))
            else:
                category_stmt = category_stmt.where(Category.is_global)
            category_res = await session.exec(category_stmt)
            if not category_res.first():
                raise ValueError(
                    f"Category with ID '{payload.category_id}' not found or not authorized for this product."
                )

        # 3. Instantiate core product
        product = Product(
            name=payload.name,
            brand=payload.brand,
            barcode=payload.barcode,
            category_id=payload.category_id,
            image_url=payload.image_url,
            base_unit=payload.base_unit,
            is_global=is_global,
            home_id=None if is_global else home_id,
        )
        session.add(product)

        # 4. Instantiate nutrition if provided
        if payload.nutrition:
            nutrition = ProductNutrition(
                calories=payload.nutrition.calories,
                fat=payload.nutrition.fat,
                saturated_fat=payload.nutrition.saturated_fat,
                carbohydrates=payload.nutrition.carbohydrates,
                sugars=payload.nutrition.sugars,
                protein=payload.nutrition.protein,
                salt=payload.nutrition.salt,
            )
            product.nutrition = nutrition
            session.add(nutrition)

        # 5. Transaction commit with rollback safety
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Integrity error creating product '{payload.name}': {e}") from e

        await session.refresh(product)
        return product

    @staticmethod
    async def get_product(
        session: AsyncSession,
        product_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> Product | None:
        """Retrieve a specific product if it is global or personal to the user's home."""
        statement = select(Product).where(
            Product.id == product_id,
            or_(Product.is_global, Product.home_id == home_id),
        )
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def get_product_nutrition(
        session: AsyncSession,
        product_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> ProductNutrition | None:
        """Retrieve the isolated nutrition profile of a product if authorized."""
        # Join Product to enforce home isolation boundary on nutrition queries
        statement = (
            select(ProductNutrition)
            .join(Product)
            .where(
                ProductNutrition.product_id == product_id,
                or_(Product.is_global, Product.home_id == home_id),
            )
        )
        result = await session.exec(statement)
        return result.first()

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
        # Barcodes are globally unique. If it exists in another home, we should raise a value error or handle it.
        # But to be safe and secure, we run a global query.
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
        # External lookups are shared globally so other spaces don't have to trigger lookups
        try:
            return await ProductService.create_product(
                session=session,
                payload=external_payload,
                home_id=home_id,
                is_global=True,  # Shared system-wide
            )
        except ValueError:
            # Handle race condition where another request created the product concurrently
            result = await session.exec(statement)
            return result.first()

    @staticmethod
    async def list_products(
        session: AsyncSession,
        home_id: uuid.UUID,
        name: str | None = None,
        barcode: str | None = None,
        category_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Product]:
        """List and search products visible to the current home space."""
        statement = select(Product).where(or_(Product.is_global, Product.home_id == home_id))

        if name:
            statement = statement.where(col(Product.name).ilike(f"%{name}%"))
        if barcode:
            statement = statement.where(Product.barcode == barcode)
        if category_id:
            statement = statement.where(Product.category_id == category_id)

        statement = statement.offset(offset).limit(limit)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def update_product(
        session: AsyncSession,
        product_id: uuid.UUID,
        home_id: uuid.UUID,
        payload: ProductUpdate,
    ) -> Product | None:
        """Partially update an existing product. Global products cannot be modified."""
        product = await ProductService.get_product(session, product_id, home_id)
        if not product:
            return None

        if product.is_global:
            raise ValueError("Global products cannot be modified.")

        update_data = payload.model_dump(exclude_unset=True)

        # Barcode uniqueness pre-check on update & global promotion logic
        if "barcode" in update_data and update_data["barcode"] != product.barcode:
            barcode_val = update_data["barcode"]
            if barcode_val and len(barcode_val.strip()) > 0:
                clash_stmt = select(Product).where(Product.barcode == barcode_val, Product.id != product.id)
                clash_res = await session.exec(clash_stmt)
                if clash_res.first():
                    raise ValueError(f"Product with barcode '{barcode_val}' already exists.")
                # Adding a valid barcode promotes local product to global
                product.is_global = True
                product.home_id = None

        # Category boundary check on update
        if "category_id" in update_data and update_data["category_id"] is not None:
            category_id = update_data["category_id"]
            from src.features.categories.models import Category

            category_stmt = select(Category).where(Category.id == category_id)
            is_now_global = product.is_global
            if not is_now_global:
                category_stmt = category_stmt.where(or_(Category.is_global, Category.home_id == home_id))
            else:
                category_stmt = category_stmt.where(Category.is_global)
            category_res = await session.exec(category_stmt)
            if not category_res.first():
                raise ValueError(f"Category with ID '{category_id}' not found or not authorized for this product.")

        for key, value in update_data.items():
            setattr(product, key, value)

        session.add(product)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Database error during product update: {e}") from e

        await session.refresh(product)
        return product

    @staticmethod
    async def update_product_nutrition(
        session: AsyncSession,
        product_id: uuid.UUID,
        home_id: uuid.UUID,
        payload: ProductNutritionUpdate,
    ) -> ProductNutrition | None:
        """Update or create the nutrition profile of an existing product.

        Global products cannot be modified.
        """
        product = await ProductService.get_product(session, product_id, home_id)
        if not product:
            return None

        if product.is_global:
            raise ValueError("Global product nutrition cannot be modified.")

        nutrition = await ProductService.get_product_nutrition(session, product_id, home_id)

        update_data = payload.model_dump(exclude_unset=True)

        if not nutrition:
            # Create new nutrition entry if it didn't exist
            nutrition = ProductNutrition(product_id=product_id, **update_data)
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

    @staticmethod
    async def delete_product(
        session: AsyncSession,
        product_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete an existing product. Global products cannot be deleted."""
        product = await ProductService.get_product(session, product_id, home_id)
        if not product:
            return False

        if product.is_global:
            raise ValueError("Global products cannot be deleted.")

        await session.delete(product)
        try:
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise ValueError(f"Database error during product deletion: {e}") from e

        return True
