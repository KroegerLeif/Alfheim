import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import (
    UserHomeContext,
    get_current_user_and_home,
)
from src.features.locations import (
    LocationRead,
    LocationCreate,
    LocationUpdate,
)
from src.features.locations.service import LocationService

router = APIRouter(prefix="/api/v1/locations", tags=["locations"])


@router.post(
    "", response_model=LocationRead, status_code=status.HTTP_201_CREATED
)
async def create_location(
    payload: LocationCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new physical storage location in the user's home space."""
    return await LocationService.create_location(
        session=session,
        payload=payload,
        owner_id=context.user_id,
        home_id=context.home_id,
    )


@router.get("", response_model=list[LocationRead])
async def list_locations(
    name: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve all storage locations in the user's home space.

    Supports filtering by name and optional pagination.
    """
    return await LocationService.list_locations(
        session=session,
        home_id=context.home_id,
        name=name,
        limit=limit,
        offset=offset,
    )


@router.get("/{id}", response_model=LocationRead)
async def get_location(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve details for a specific storage location by ID."""
    location = await LocationService.get_location(
        session=session,
        location_id=id,
        home_id=context.home_id,
    )
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
    location = await LocationService.update_location(
        session=session,
        location_id=id,
        home_id=context.home_id,
        payload=payload,
    )
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found.",
        )
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
    deleted = await LocationService.delete_location(
        session=session,
        location_id=id,
        home_id=context.home_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found.",
        )
