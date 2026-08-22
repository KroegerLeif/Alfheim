import logging
import uuid
from collections.abc import Sequence

from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.shopping_lists.models import ShoppingItem, ShoppingList
from src.features.shopping_lists.schemas import (
    PushItemPayload,
    ShoppingItemCreate,
    ShoppingItemUpdate,
    ShoppingListCreate,
    SyncToPantryResponse,
)
from src.features.shopping_lists.services.list_management_service import ListManagementService
from src.features.shopping_lists.services.pantry_sync_service import PantrySyncService
from src.features.shopping_lists.services.shopping_item_service import ShoppingItemService

logger = logging.getLogger(__name__)


class ShoppingListService:
    """Service class encapsulating business operations for Shopping Lists and Shopping Items.

    Delegates responsibilities to domain sub-services (ListManagementService,
    ShoppingItemService, and PantrySyncService).
    """

    @staticmethod
    def _personal_list_name(username: str | None, user_id: uuid.UUID) -> str:
        return ListManagementService.personal_list_name(username, user_id)

    @staticmethod
    async def _ensure_personal_list(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
        username: str | None,
    ) -> ShoppingList:
        return await ListManagementService.ensure_personal_list(session, home_id, owner_id, username)

    @staticmethod
    async def _ensure_household_list(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingList:
        return await ListManagementService.ensure_household_list(session, home_id, owner_id)

    @staticmethod
    async def create_list(
        session: AsyncSession,
        payload: ShoppingListCreate,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingList:
        return await ListManagementService.create_list(session, payload, home_id, owner_id)

    @staticmethod
    async def get_lists(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID | None = None,
        username: str | None = None,
        token: str | None = None,
    ) -> Sequence[ShoppingList]:
        return await ListManagementService.get_lists(session, home_id, owner_id, username, token)

    @staticmethod
    async def get_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> ShoppingList:
        return await ListManagementService.get_list(session, list_id, home_id)

    @staticmethod
    async def delete_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        return await ListManagementService.delete_list(session, list_id, home_id)

    @staticmethod
    async def reorder_lists(
        session: AsyncSession,
        list_ids: list[uuid.UUID],
        home_id: uuid.UUID,
    ) -> bool:
        return await ListManagementService.reorder_lists(session, list_ids, home_id)

    @staticmethod
    async def add_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        payload: ShoppingItemCreate,
        home_id: uuid.UUID,
    ) -> ShoppingItem:
        return await ShoppingItemService.add_item(session, list_id, payload, home_id)

    @staticmethod
    async def push_item(
        session: AsyncSession,
        payload: PushItemPayload,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingItem:
        return await ShoppingItemService.push_item(session, payload, home_id, owner_id)

    @staticmethod
    async def update_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        item_id: uuid.UUID,
        payload: ShoppingItemUpdate,
        home_id: uuid.UUID,
    ) -> ShoppingItem:
        return await ShoppingItemService.update_item(session, list_id, item_id, payload, home_id)

    @staticmethod
    async def delete_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        item_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        return await ShoppingItemService.delete_item(session, list_id, item_id, home_id)

    @staticmethod
    async def auto_import_low_stock(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
        token: str | None = None,
    ) -> list[ShoppingItem]:
        await ListManagementService.get_list(session, list_id, home_id)
        return await PantrySyncService.auto_import_low_stock(
            session=session,
            list_id=list_id,
            home_id=home_id,
            token=token,
        )

    @staticmethod
    async def sync_to_pantry(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
        token: str | None = None,
    ) -> SyncToPantryResponse:
        await ListManagementService.get_list(session, list_id, home_id)
        return await PantrySyncService.sync_to_pantry(
            session=session,
            list_id=list_id,
            home_id=home_id,
            token=token,
        )
