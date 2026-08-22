import logging
import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.exceptions import (
    ShoppingItemNotFoundError,
)
from src.features.shopping_lists.models import ShoppingItem, ShoppingList
from src.features.shopping_lists.schemas import (
    PushItemPayload,
    ShoppingItemCreate,
    ShoppingItemUpdate,
)
from src.features.shopping_lists.services.list_management_service import ListManagementService

logger = logging.getLogger(__name__)


class ShoppingItemService:
    """Service class encapsulating CRUD operations for Shopping Items."""

    @staticmethod
    async def add_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        payload: ShoppingItemCreate,
        home_id: uuid.UUID,
    ) -> ShoppingItem:
        """Add a manual shopping item to a list."""
        # Validate list ownership / boundary
        await ListManagementService.get_list(session, list_id, home_id)

        db_item = ShoppingItem(
            list_id=list_id,
            name=payload.name.strip(),
            brand=payload.brand.strip() if payload.brand else None,
            barcode=payload.barcode.strip() if payload.barcode else None,
            quantity=payload.quantity,
            unit=payload.unit.strip().lower(),
        )
        session.add(db_item)
        await session.commit()
        await session.refresh(db_item)
        return db_item

    @staticmethod
    async def push_item(
        session: AsyncSession,
        payload: PushItemPayload,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingItem:
        """Push an out-of-stock item directly into a household shopping list.

        When no explicit list_id is supplied, the item lands in the Household List
        (is_default=True) for the active home_id, falling back to the first list.
        """
        list_id = payload.list_id
        if list_id:
            await ListManagementService.get_list(session, list_id, home_id)
        else:
            # Prefer the shared Household List for cross-service pushes
            stmt = select(ShoppingList).where(
                ShoppingList.home_id == home_id,
                ShoppingList.is_default == True,  # noqa: E712
            )
            result = await session.exec(stmt)
            household = result.first()
            if household:
                list_id = household.id
            else:
                # Fallback: first list in scope
                lists = await ListManagementService.get_lists(session, home_id, owner_id)
                list_id = lists[0].id

        db_item = ShoppingItem(
            list_id=list_id,
            name=payload.name.strip(),
            brand=payload.brand.strip() if payload.brand else None,
            barcode=payload.barcode.strip() if payload.barcode else None,
            quantity=payload.quantity,
            unit=payload.unit.strip().lower(),
            is_auto_generated=True,
            product_id=payload.product_id,
        )
        session.add(db_item)
        await session.commit()
        await session.refresh(db_item)
        return db_item

    @staticmethod
    async def update_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        item_id: uuid.UUID,
        payload: ShoppingItemUpdate,
        home_id: uuid.UUID,
    ) -> ShoppingItem:
        """Update an existing item's quantity, unit, or completion status."""
        await ListManagementService.get_list(session, list_id, home_id)

        stmt = select(ShoppingItem).where(
            ShoppingItem.id == item_id,
            ShoppingItem.list_id == list_id,
        )
        result = await session.exec(stmt)
        db_item = result.first()
        if not db_item:
            raise ShoppingItemNotFoundError(f"Shopping item with ID '{item_id}' not found.")

        # Partially update fields
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            if key == "name" and value:
                value = value.strip()
            elif key == "brand" and value:
                value = value.strip()
            elif key == "barcode" and value:
                value = value.strip()
            elif key == "unit" and value:
                value = value.strip().lower()
            setattr(db_item, key, value)

        session.add(db_item)
        await session.commit()
        await session.refresh(db_item)
        return db_item

    @staticmethod
    async def delete_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        item_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete an item from a list."""
        await ListManagementService.get_list(session, list_id, home_id)

        stmt = select(ShoppingItem).where(
            ShoppingItem.id == item_id,
            ShoppingItem.list_id == list_id,
        )
        result = await session.exec(stmt)
        db_item = result.first()
        if not db_item:
            raise ShoppingItemNotFoundError(f"Shopping item with ID '{item_id}' not found.")

        await session.delete(db_item)
        await session.commit()
        return True
