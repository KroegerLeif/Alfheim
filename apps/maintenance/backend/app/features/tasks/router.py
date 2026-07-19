import datetime
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
import httpx

from app.core.database import get_db_session
from app.features.devices.models import Device
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
from app.features.tasks.schemas import MaintenanceSubmission
from app.features.devices.schemas import ServiceHistoryEventRead, ServiceHistoryEventDetailRead

router = APIRouter(prefix="/api/v1", tags=["tasks"])


def add_months(source_date: datetime.date, months: int) -> datetime.date:
    """Helper to add months to a date, handling month-end constraints correctly."""
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(source_date.day, [31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1])
    return datetime.date(year, month, day)


async def forward_supplies_to_shopping(supply_items: List[str]) -> None:
    """Send parts list to the shopping-backend service."""
    async with httpx.AsyncClient() as client:
        for item in supply_items:
            try:
                # Format payload for shopping backend add_item endpoint
                payload = {
                    "name": item,
                    "quantity": 1.0,
                    "unit": "piece"
                }
                # Target the global shopping items endpoint
                response = await client.post(
                    "http://shopping-backend:8000/api/v1/shopping/items",
                    json=payload,
                    timeout=5.0
                )
                if response.status_code >= 400:
                    logging.error(f"Failed to forward item '{item}' to shopping backend: status {response.status_code}")
            except Exception as e:
                logging.error(f"Error forwarding item '{item}' to shopping backend: {e}")


@router.post(
    "/submit",
    response_model=ServiceHistoryEventRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit maintenance logs and update steps",
)
async def submit_maintenance(
    payload: MaintenanceSubmission,
    session: AsyncSession = Depends(get_db_session),
):
    """Logs a new service history event and updates completed steps' due dates.
    
    Optionally forwards needed parts to the shopping-backend microservice.
    """
    # 1. Verify device exists
    device = await session.get(Device, payload.device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    # 2. Fetch the completed steps to verify and extract their titles
    completed_steps_titles = []
    if payload.completed_step_ids:
        steps_statement = select(MaintenanceStep).where(
            MaintenanceStep.id.in_(payload.completed_step_ids),
            MaintenanceStep.device_id == payload.device_id
        )
        result = await session.execute(steps_statement)
        completed_steps = result.scalars().all()
        
        # Verify if all specified steps exist for this device
        if len(completed_steps) != len(payload.completed_step_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more step IDs are invalid for this device"
            )
        
        today = datetime.date.today()
        # Update completed steps
        for step in completed_steps:
            completed_steps_titles.append(step.title)
            step.last_completed = today.isoformat()
            step.supply_needed_date = add_months(today, step.recurrence).isoformat()
            session.add(step)

    # 3. Create the new service history event
    event = ServiceHistoryEvent(
        date=datetime.date.today().isoformat(),
        performer=payload.performer,
        notes=payload.step_notes,
        device_id=payload.device_id,
        completed_steps=completed_steps_titles
    )
    session.add(event)
    
    # 4. Commit transaction
    await session.commit()
    await session.refresh(event)

    # 5. Inter-service forward (Shopping App bridge)
    if payload.supply_items:
        # Trigger forwarding logic. Wrapped so any HTTP errors do not affect the client response.
        try:
            await forward_supplies_to_shopping(payload.supply_items)
        except Exception as e:
            logging.error(f"Uncaught exception during supply forwarding: {e}")

    return event


@router.get(
    "/history",
    response_model=List[ServiceHistoryEventDetailRead],
    summary="Retrieve service history events sorted newest first",
)
async def get_service_history(
    household_id: Optional[int] = Query(default=None, description="Optional household filter"),
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch all ServiceHistoryEvent records joined with their Device.

    Results are sorted in descending chronological order (newest first).
    An optional household_id parameter filters events to devices belonging
    to that household only.
    """
    statement = (
        select(ServiceHistoryEvent)
        .options(selectinload(ServiceHistoryEvent.device))
        .order_by(ServiceHistoryEvent.date.desc())
    )
    result = await session.execute(statement)
    events = result.scalars().all()

    # Apply household filter post-load (avoids a join on device table)
    if household_id is not None:
        events = [e for e in events if e.device and e.device.household_id == household_id]

    # Build enriched response dicts with denormalised device fields
    return [
        ServiceHistoryEventDetailRead(
            id=e.id,
            date=e.date,
            performer=e.performer,
            notes=e.notes,
            device_id=e.device_id,
            device_name=e.device.name if e.device else "Unknown",
            device_location=e.device.location if e.device else "Unknown",
            completed_steps=e.completed_steps,
        )
        for e in events
    ]
