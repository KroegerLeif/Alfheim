import logging
import os
import uuid
from collections.abc import Sequence

import httpx
from fastapi import APIRouter, Depends, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.core.dependencies import UserHomeContext, get_current_user_and_home
from src.features.shopping_lists.schemas import (
    HouseholdRead,
    PushItemPayload,
    ReorderListsPayload,
    ShoppingItemCreate,
    ShoppingItemRead,
    ShoppingItemUpdate,
    ShoppingListCreate,
    ShoppingListRead,
    SyncToPantryResponse,
)
from src.features.shopping_lists.service import ShoppingListService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/shopping-lists", tags=["shopping-lists"])
items_router = APIRouter(prefix="/api/v1/shopping/items", tags=["shopping-items"])
households_router = APIRouter(prefix="/api/v1/households", tags=["households"])


@households_router.get(
    "/me",
    response_model=list[HouseholdRead],
    summary="Retrieve user households",
)
async def get_my_households(
    request: Request,
):
    """Proxy request to central dashboard backend to retrieve user households."""
    token = request.headers.get("Authorization")
    headers = {}
    if token:
        headers["Authorization"] = token

    dashboard_url = os.getenv("DASHBOARD_BACKEND_URL", "http://dashboard-backend:8080")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{dashboard_url}/api/v1/households/me", headers=headers, timeout=5.0)
            if response.status_code == 200:
                return response.json()
            logger.warning(
                "Dashboard endpoint returned status code %s when retrieving households.", response.status_code
            )
            return []
        except (httpx.RequestError, ValueError) as exc:
            logger.warning("Failed to proxy households retrieval request to dashboard backend: %s", exc)
            return []


@router.post(
    "",
    response_model=ShoppingListRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new shopping list",
)
async def create_list(
    payload: ShoppingListCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new shopping list scoped to the current user's household context."""
    return await ShoppingListService.create_list(
        session=session,
        payload=payload,
        home_id=context.home_id,
        owner_id=context.user_id,
    )


@router.get(
    "",
    response_model=Sequence[ShoppingListRead],
    summary="Retrieve all shopping lists",
)
async def get_lists(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve all shopping lists visible to the caller.

    Auto-provisions the Personal List (user-bound) and Household List (home-bound)
    on first access. Returns them in stable order: personal → household → custom.
    """
    token = request.headers.get("Authorization")
    return await ShoppingListService.get_lists(
        session=session,
        home_id=context.home_id,
        owner_id=context.user_id,
        username=context.username,
        token=token,
    )


@router.patch(
    "/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Update display position indices of shopping lists",
)
async def reorder_lists(
    payload: ReorderListsPayload,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Update display position indices for multiple user-defined shopping lists in bulk."""
    await ShoppingListService.reorder_lists(
        session=session,
        list_ids=payload.list_ids,
        home_id=context.home_id,
    )


@router.get(
    "/{list_id}",
    response_model=ShoppingListRead,
    summary="Retrieve details of a specific shopping list",
)
async def get_list(
    list_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve details and items of a specific shopping list with authorization checks."""
    return await ShoppingListService.get_list(
        session=session,
        list_id=list_id,
        home_id=context.home_id,
    )


@router.delete(
    "/{list_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a shopping list",
)
async def delete_list(
    list_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete a shopping list along with all its nested checklist items."""
    await ShoppingListService.delete_list(
        session=session,
        list_id=list_id,
        home_id=context.home_id,
    )


@router.post(
    "/{list_id}/items",
    response_model=ShoppingItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add an item to a shopping list",
)
async def add_item(
    list_id: uuid.UUID,
    payload: ShoppingItemCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Add a new custom/manual item to the specified shopping list."""
    return await ShoppingListService.add_item(
        session=session,
        list_id=list_id,
        payload=payload,
        home_id=context.home_id,
    )


@router.patch(
    "/{list_id}/items/{item_id}",
    response_model=ShoppingItemRead,
    summary="Update a shopping item",
)
async def update_item(
    list_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: ShoppingItemUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Update properties (quantity, unit, completion check-off state) of a shopping item."""
    return await ShoppingListService.update_item(
        session=session,
        list_id=list_id,
        item_id=item_id,
        payload=payload,
        home_id=context.home_id,
    )


@router.delete(
    "/{list_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an item from the shopping list",
)
async def delete_item(
    list_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Remove a specific item from the shopping list."""
    await ShoppingListService.delete_item(
        session=session,
        list_id=list_id,
        item_id=item_id,
        home_id=context.home_id,
    )


@router.post(
    "/{list_id}/auto-import-low-stock",
    response_model=list[ShoppingItemRead],
    summary="Import low stock items from Pantry",
)
async def auto_import_low_stock(
    list_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Fetch low-stock catalog alerts from Pantry and merge them as auto-generated items."""
    token = request.headers.get("Authorization")
    return await ShoppingListService.auto_import_low_stock(
        session=session,
        list_id=list_id,
        home_id=context.home_id,
        token=token,
    )


@router.post(
    "/{list_id}/sync-to-pantry",
    response_model=SyncToPantryResponse,
    summary="Sync completed items to Pantry",
)
async def sync_to_pantry(
    list_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Sync completed items on the list in bulk to Pantry stock and record purchase frequencies."""
    token = request.headers.get("Authorization")
    return await ShoppingListService.sync_to_pantry(
        session=session,
        list_id=list_id,
        home_id=context.home_id,
        token=token,
    )


@items_router.post(
    "",
    response_model=ShoppingItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Push an out-of-stock item to the household shopping list",
)
async def push_shopping_item(
    payload: PushItemPayload,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Internal inter-service API allowing Pantry or external callers to push out-of-stock items directly to the household shopping list."""
    return await ShoppingListService.push_item(
        session=session,
        payload=payload,
        home_id=context.home_id,
        owner_id=context.user_id,
    )
