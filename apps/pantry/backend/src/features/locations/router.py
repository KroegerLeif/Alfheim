import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import (
    UserHomeContext,
    get_current_user_and_home,
)
from src.features.locations import (
    Location,
    LocationCreate,
    LocationRead,
    LocationUpdate,
)

router = APIRouter(prefix="/api/v1/locations", tags=["locations"])


async def reassign_items_to_fallback(
    session: AsyncSession,
    old_location_id: uuid.UUID,
    fallback_location_id: uuid.UUID,
) -> None:
    """Helper function to reassign pantry items to the fallback location.

    Currently a stub since the Item/Product tables do not exist yet.
    When the Items feature is introduced, this function will perform the update.
    """
    # TODO: Once the Item model is defined, run the update query:
    # from src.features.items.models import Item
    # from sqlalchemy import update
    # await session.execute(
    #     update(Item)
    #     .where(Item.location_id == old_location_id)
    #     .values(location_id=fallback_location_id)
    # )
    pass


@router.post(
    "", response_model=LocationRead, status_code=status.HTTP_201_CREATED
)
async def create_location(
    payload: LocationCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new physical storage location in the user's home space."""
    location = Location(
        name=payload.name,
        description=payload.description,
        is_system=False,
        owner_id=context.user_id,
        home_id=context.home_id,
    )
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


@router.get("", response_model=list[LocationRead])
async def list_locations(
    name: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve all storage locations in the user's home space.

    Supports filtering by name (which can return multiple matches since names are not unique)
    and optional pagination.
    """
    statement = select(Location).where(Location.home_id == context.home_id)

    if name:
        statement = statement.where(Location.name == name)

    statement = statement.offset(offset).limit(limit)
    result = await session.exec(statement)
    return result.all()


@router.get("/{id}", response_model=LocationRead)
async def get_location(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve details for a specific storage location by ID."""
    statement = select(Location).where(
        Location.id == id, Location.home_id == context.home_id
    )
    result = await session.exec(statement)
    location = result.first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found.",
        )

    return location


@router.patch("/{id}", response_model=LocationRead)
async def update_location(
    id: uuid.UUID,
    payload: LocationUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Partially update an existing location's properties.

    System locations (like Backlog) are protected and cannot be modified.
    """
    statement = select(Location).where(
        Location.id == id, Location.home_id == context.home_id
    )
    result = await session.exec(statement)
    location = result.first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found.",
        )

    if location.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System locations cannot be modified or deleted.",
        )

    # Apply updates
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(location, key, value)

    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete a storage location.

    All pantry items currently in the deleted location will be automatically
    reassigned to the fallback 'Backlog' system location. System locations cannot be deleted.
    """
    statement = select(Location).where(
        Location.id == id, Location.home_id == context.home_id
    )
    result = await session.exec(statement)
    location = result.first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found.",
        )

    if location.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System locations cannot be modified or deleted.",
        )

    # 1. Locate the default fallback location for this home
    fallback_statement = select(Location).where(
        Location.home_id == context.home_id, Location.is_system
    )
    fallback_result = await session.exec(fallback_statement)
    fallback = fallback_result.first()

    if not fallback:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System fallback location ('Backlog') could not be found.",
        )

    # 2. Reassign any stored items to the fallback location
    await reassign_items_to_fallback(
        session, old_location_id=location.id, fallback_location_id=fallback.id
    )

    # 3. Delete the target location
    await session.delete(location)
    await session.commit()
