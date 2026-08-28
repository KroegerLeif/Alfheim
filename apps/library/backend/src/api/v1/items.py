"""API router for library item management."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.db.models import Item, LendingStatus, Location, MediaType, ProviderSubscription
from src.schemas.items import (
    ItemCreate,
    ItemListResponse,
    ItemResponse,
    ItemUpdate,
)

router = APIRouter(prefix="/items", tags=["items"])


async def _get_item_or_404(
    item_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> Item:
    """Retrieve item by ID for household or raise 404 HTTP Exception."""
    statement = select(Item).where(
        Item.id == item_id,
        Item.household_id == household_id,
    )
    result = await session.execute(statement)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID '{item_id}' not found.",
        )
    return item


async def _validate_location_ownership(
    location_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Verify location belongs to the current active household."""
    statement = select(Location.id).where(
        Location.id == location_id,
        Location.household_id == household_id,
    )
    res = await session.execute(statement)
    if not res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Location with ID '{location_id}' does not exist in household.",
        )


async def _validate_provider_ownership(
    provider_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Verify provider subscription belongs to the current active household."""
    statement = select(ProviderSubscription.id).where(
        ProviderSubscription.id == provider_id,
        ProviderSubscription.household_id == household_id,
    )
    res = await session.execute(statement)
    if not res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider subscription with ID '{provider_id}' does not exist in household.",
        )


@router.post(
    "",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create item",
)
async def create_item(
    payload: ItemCreate,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Create a new media item in the active household library."""
    if payload.location_id:
        await _validate_location_ownership(payload.location_id, household_id, session)

    if payload.provider_id:
        await _validate_provider_ownership(payload.provider_id, household_id, session)

    item = Item(
        household_id=household_id,
        **payload.model_dump(),
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.get(
    "",
    response_model=ItemListResponse,
    summary="List items",
)
async def list_items(
    skip: int = Query(default=0, ge=0, description="Number of items to skip for pagination."),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of items to return."),
    location_id: uuid.UUID | None = Query(default=None, description="Filter items by location ID."),
    media_type: MediaType | None = Query(default=None, description="Filter items by media type."),
    is_cookbook: bool | None = Query(default=None, description="Filter items by cookbook flag."),
    lending_status: LendingStatus | None = Query(
        default=None, alias="status", description="Filter items by lending status."
    ),
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """List media items for active household with filtering and pagination."""
    query = select(Item).where(Item.household_id == household_id)

    if location_id is not None:
        query = query.where(Item.location_id == location_id)
    if media_type is not None:
        query = query.where(Item.media_type == media_type)
    if is_cookbook is not None:
        query = query.where(Item.is_cookbook == is_cookbook)
    if lending_status is not None:
        query = query.where(Item.status == lending_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await session.execute(count_query)
    total = total_res.scalar_one()

    paginated_query = query.offset(skip).limit(limit)
    result = await session.execute(paginated_query)
    items = list(result.scalars().all())

    return ItemListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{item_id}",
    response_model=ItemResponse,
    summary="Get item details",
)
async def get_item(
    item_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Retrieve details of a single media item."""
    return await _get_item_or_404(item_id, household_id, session)


@router.put(
    "/{item_id}",
    response_model=ItemResponse,
    summary="Update item",
)
async def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Update details of a media item."""
    item = await _get_item_or_404(item_id, household_id, session)

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("location_id"):
        await _validate_location_ownership(update_data["location_id"], household_id, session)

    if update_data.get("provider_id"):
        await _validate_provider_ownership(update_data["provider_id"], household_id, session)

    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete item",
)
async def delete_item(
    item_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a media item from the library."""
    item = await _get_item_or_404(item_id, household_id, session)
    await session.delete(item)
    await session.commit()
