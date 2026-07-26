import uuid
from typing import List, Sequence
from fastapi import APIRouter, Depends, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import get_current_user_and_home, UserHomeContext
from src.features.shopping_lists.service import ShoppingListService
from src.features.shopping_lists.schemas import (
    ShoppingListCreate,
    ShoppingListRead,
    ShoppingItemCreate,
    ShoppingItemUpdate,
    ShoppingItemRead,
    PushItemPayload,
    SyncToPantryResponse,
)

router = APIRouter(prefix="/api/v1/shopping-lists", tags=["shopping-lists"])
items_router = APIRouter(prefix="/api/v1/shopping/items", tags=["shopping-items"])


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
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve all shopping lists shared within the current household context."""
    return await ShoppingListService.get_lists(
        session=session,
        home_id=context.home_id,
        owner_id=context.user_id,
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
    response_model=List[ShoppingItemRead],
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
