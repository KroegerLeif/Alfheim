"""API router for physical location management."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select

from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.db.models import Item, Location
from src.errors import CODE_LOCATION_IN_USE, error_detail
from src.schemas.locations import (
    LocationCreate,
    LocationResponse,
    LocationTreeNode,
    LocationUpdate,
)

router = APIRouter(prefix="/locations", tags=["locations"])


async def _get_location_or_404(
    location_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> Location:
    """Retrieve location by ID for household or raise 404 HTTP Exception."""
    statement = select(Location).where(
        Location.id == location_id,
        Location.household_id == household_id,
    )
    result = await session.execute(statement)
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID '{location_id}' not found.",
        )
    return location


async def _is_ancestor_of(
    potential_ancestor_id: uuid.UUID,
    target_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> bool:
    """Check if potential_ancestor_id is an ancestor of target_id to prevent cyclic hierarchies."""
    current_id: uuid.UUID | None = target_id
    visited = set()

    while current_id is not None:
        if current_id in visited:
            break
        visited.add(current_id)

        if current_id == potential_ancestor_id:
            return True

        statement = select(Location.parent_id).where(
            Location.id == current_id,
            Location.household_id == household_id,
        )
        res = await session.execute(statement)
        current_id = res.scalar_one_or_none()

    return False


async def _count_items_in_subtree(
    location_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> int:
    """Count items stored at a location or at any of its descendants."""
    rows = await session.execute(select(Location.id, Location.parent_id).where(Location.household_id == household_id))
    children_by_parent: dict[uuid.UUID, list[uuid.UUID]] = {}
    for child_id, parent_id in rows.all():
        if parent_id is not None:
            children_by_parent.setdefault(parent_id, []).append(child_id)

    subtree_ids: list[uuid.UUID] = []
    pending = [location_id]
    while pending:
        current = pending.pop()
        subtree_ids.append(current)
        pending.extend(children_by_parent.get(current, []))

    count = await session.execute(
        select(func.count())
        .select_from(Item)
        .where(Item.household_id == household_id, col(Item.location_id).in_(subtree_ids))
    )
    return count.scalar_one()


def _build_location_tree(locations: list[Location]) -> list[LocationTreeNode]:
    """Transform flat list of locations into hierarchical tree structure."""
    nodes_map: dict[uuid.UUID, LocationTreeNode] = {}
    for loc in locations:
        nodes_map[loc.id] = LocationTreeNode(
            id=loc.id,
            household_id=loc.household_id,
            name=loc.name,
            description=loc.description,
            parent_id=loc.parent_id,
            created_at=loc.created_at,
            updated_at=loc.updated_at,
            children=[],
        )

    root_nodes: list[LocationTreeNode] = []
    for loc in locations:
        node = nodes_map[loc.id]
        if loc.parent_id and loc.parent_id in nodes_map:
            nodes_map[loc.parent_id].children.append(node)
        else:
            root_nodes.append(node)

    return root_nodes


@router.post(
    "",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create location",
)
async def create_location(
    payload: LocationCreate,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Create a new storage location for the active household."""
    if payload.parent_id:
        await _get_location_or_404(payload.parent_id, household_id, session)

    location = Location(
        household_id=household_id,
        name=payload.name,
        description=payload.description,
        parent_id=payload.parent_id,
    )
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


@router.get(
    "",
    response_model=list[LocationTreeNode] | list[LocationResponse],
    summary="List locations",
)
async def list_locations(
    tree: bool = Query(
        default=False,
        description="Return locations as a hierarchical tree if true.",
    ),
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """List storage locations for the active household."""
    statement = select(Location).where(Location.household_id == household_id)
    result = await session.execute(statement)
    locations = list(result.scalars().all())

    if tree:
        return _build_location_tree(locations)

    return locations


@router.get(
    "/{location_id}",
    response_model=LocationResponse,
    summary="Get location details",
)
async def get_location(
    location_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Retrieve details of a single storage location."""
    return await _get_location_or_404(location_id, household_id, session)


@router.put(
    "/{location_id}",
    response_model=LocationResponse,
    summary="Update location",
)
async def update_location(
    location_id: uuid.UUID,
    payload: LocationUpdate,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Update details or parent hierarchy of a storage location."""
    location = await _get_location_or_404(location_id, household_id, session)

    update_data = payload.model_dump(exclude_unset=True)

    if "parent_id" in update_data and update_data["parent_id"] is not None:
        new_parent_id = update_data["parent_id"]
        if new_parent_id == location_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A location cannot be its own parent.",
            )
        await _get_location_or_404(new_parent_id, household_id, session)

        # Check for circular dependency
        if await _is_ancestor_of(
            potential_ancestor_id=location_id,
            target_id=new_parent_id,
            household_id=household_id,
            session=session,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set parent location as it introduces a cycle in hierarchy.",
            )

    for field, value in update_data.items():
        setattr(location, field, value)

    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


@router.delete(
    "/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete location",
)
async def delete_location(
    location_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a storage location together with its (empty) sub-locations.

    Raises 409 ``location_in_use`` while any item is still stored at the location or one of its
    descendants, so a delete never silently unlinks items or fails on the foreign key.
    """
    location = await _get_location_or_404(location_id, household_id, session)
    item_count = await _count_items_in_subtree(location_id, household_id, session)
    if item_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_detail(
                CODE_LOCATION_IN_USE,
                f"Location '{location.name}' still holds {item_count} item(s). Move or delete them first.",
                item_count=item_count,
            ),
        )
    await session.delete(location)
    await session.commit()
