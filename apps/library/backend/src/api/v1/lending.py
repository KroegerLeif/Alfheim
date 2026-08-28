"""API router for library lending management."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.db.models import Item, LendingRecord, LendingStatus
from src.schemas.lending import (
    LendingRecordListResponse,
    LendingRecordResponse,
    LendItemRequest,
    ReturnItemRequest,
)

router = APIRouter(tags=["lending"])


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
    result = await session.exec(statement)
    item = result.one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID '{item_id}' not found.",
        )
    return item


@router.post(
    "/items/{item_id}/lend",
    response_model=LendingRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lend item",
)
@router.post(
    "/lending/items/{item_id}/lend",
    response_model=LendingRecordResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def lend_item(
    item_id: uuid.UUID,
    payload: LendItemRequest,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Lend a media item to a contact."""
    item = await _get_item_or_404(item_id, household_id, session)

    if item.status == LendingStatus.LENT_OUT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Item '{item.title}' is already lent out.",
        )

    lent_timestamp = payload.lent_at or datetime.now(UTC)

    lending_record = LendingRecord(
        household_id=household_id,
        item_id=item_id,
        contact_name=payload.contact_name,
        status=LendingStatus.LENT_OUT,
        lent_at=lent_timestamp,
        due_date=payload.due_date,
        notes=payload.notes,
    )

    item.status = LendingStatus.LENT_OUT

    session.add(lending_record)
    session.add(item)
    await session.commit()
    await session.refresh(lending_record)

    return lending_record


@router.post(
    "/items/{item_id}/return",
    response_model=LendingRecordResponse,
    summary="Return item",
)
@router.post(
    "/lending/items/{item_id}/return",
    response_model=LendingRecordResponse,
    include_in_schema=False,
)
async def return_item(
    item_id: uuid.UUID,
    payload: ReturnItemRequest | None = None,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Mark a lent media item as returned."""
    item = await _get_item_or_404(item_id, household_id, session)

    if item.status != LendingStatus.LENT_OUT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Item '{item.title}' is not currently lent out.",
        )

    statement = (
        select(LendingRecord)
        .where(
            LendingRecord.household_id == household_id,
            LendingRecord.item_id == item_id,
            LendingRecord.status == LendingStatus.LENT_OUT,
        )
        .order_by(LendingRecord.created_at.desc())
    )
    result = await session.exec(statement)
    active_record = result.one_or_none()

    returned_timestamp = (payload and payload.returned_at) or datetime.now(UTC)

    if active_record:
        active_record.status = LendingStatus.AVAILABLE
        active_record.returned_at = returned_timestamp
        if payload and payload.notes:
            if active_record.notes:
                active_record.notes = f"{active_record.notes}\nReturn note: {payload.notes}"
            else:
                active_record.notes = f"Return note: {payload.notes}"
        session.add(active_record)
        record_to_return = active_record
    else:
        # Fallback if status was LENT_OUT but no active record found
        record_to_return = LendingRecord(
            household_id=household_id,
            item_id=item_id,
            contact_name="Unknown",
            status=LendingStatus.AVAILABLE,
            lent_at=returned_timestamp,
            returned_at=returned_timestamp,
            notes=payload.notes if payload else None,
        )
        session.add(record_to_return)

    item.status = LendingStatus.AVAILABLE
    session.add(item)

    await session.commit()
    await session.refresh(record_to_return)

    return record_to_return


@router.get(
    "/lending/history",
    response_model=LendingRecordListResponse,
    summary="Get lending history",
)
@router.get(
    "/lending",
    response_model=LendingRecordListResponse,
    include_in_schema=False,
)
async def list_lending_history(
    skip: int = Query(default=0, ge=0, description="Number of records to skip."),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of records to return."),
    item_id: uuid.UUID | None = Query(default=None, description="Filter records by item ID."),
    contact_name: str | None = Query(default=None, description="Filter records by borrower name."),
    lending_status: LendingStatus | None = Query(
        default=None, alias="status", description="Filter records by lending status."
    ),
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Retrieve paginated lending record history for active household."""
    query = select(LendingRecord).where(LendingRecord.household_id == household_id)

    if item_id is not None:
        query = query.where(LendingRecord.item_id == item_id)
    if contact_name is not None:
        query = query.where(LendingRecord.contact_name.icontains(contact_name))
    if lending_status is not None:
        query = query.where(LendingRecord.status == lending_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await session.exec(count_query)
    total = total_res.one()

    paginated_query = query.order_by(LendingRecord.lent_at.desc()).offset(skip).limit(limit)
    result = await session.exec(paginated_query)
    records = list(result.all())

    return LendingRecordListResponse(
        records=records,
        total=total,
        skip=skip,
        limit=limit,
    )
