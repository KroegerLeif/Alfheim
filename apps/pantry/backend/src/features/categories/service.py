import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.categories.models import Category, CategoryCreate, CategoryUpdate


class CategoryService:
    """Service class encapsulating async database operations for Categories."""

    @staticmethod
    async def create_category(
        session: AsyncSession,
        payload: CategoryCreate,
        owner_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> Category:
        """Create a new personal category in the user's home space."""
        # Service-level check: Verify name doesn't clash with any active category for this home
        # (either global or existing personal categories in this home)
        clash_stmt = select(Category).where(
            Category.name == payload.name, or_(Category.home_id == home_id, Category.is_global)
        )
        clash_res = await session.exec(clash_stmt)
        if clash_res.first():
            raise ValueError(f"Category with name '{payload.name}' already exists for this home.")

        category = Category(
            name=payload.name,
            description=payload.description,
            is_global=False,
            owner_id=owner_id,
            home_id=home_id,
        )
        session.add(category)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Category with name '{payload.name}' already exists.") from e
        await session.refresh(category)
        return category

    @staticmethod
    async def get_category(
        session: AsyncSession,
        category_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> Category | None:
        """Retrieve a specific active category (either global or personal to the home)."""
        statement = select(Category).where(
            Category.id == category_id, or_(Category.home_id == home_id, Category.is_global)
        )
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def list_categories(
        session: AsyncSession,
        home_id: uuid.UUID,
        name: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Category]:
        """Retrieve a list of active categories (global + personal) with optional filtering and pagination."""
        statement = select(Category).where(or_(Category.home_id == home_id, Category.is_global))

        if name:
            statement = statement.where(Category.name == name)

        statement = statement.offset(offset).limit(limit)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def update_category(
        session: AsyncSession,
        category_id: uuid.UUID,
        home_id: uuid.UUID,
        payload: CategoryUpdate,
    ) -> Category | None:
        """Partially update an existing personal category. Global categories cannot be modified."""
        category = await CategoryService.get_category(session, category_id, home_id)
        if not category:
            return None

        if category.is_global:
            raise ValueError("Global categories cannot be modified.")

        update_data = payload.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"] != category.name:
            # Check for naming conflict
            clash_stmt = select(Category).where(
                Category.name == update_data["name"],
                Category.id != category.id,
                or_(Category.home_id == home_id, Category.is_global),
            )
            clash_res = await session.exec(clash_stmt)
            if clash_res.first():
                raise ValueError(f"Category with name '{update_data['name']}' already exists.")

        for key, value in update_data.items():
            setattr(category, key, value)

        session.add(category)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Category name conflict: {e}") from e
        await session.refresh(category)
        return category

    @staticmethod
    async def delete_category(
        session: AsyncSession,
        category_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete an existing personal category. Global categories cannot be deleted."""
        category = await CategoryService.get_category(session, category_id, home_id)
        if not category:
            return False

        if category.is_global:
            raise ValueError("Global categories cannot be deleted.")

        await session.delete(category)
        await session.commit()
        return True
