from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db_session
from app.features.devices.models import Household, Device
from app.features.tasks.models import MaintenanceStep
from app.features.devices.schemas import HouseholdRead, DeviceRead, DeviceCreate

router = APIRouter(prefix="/api/v1", tags=["devices"])


@router.get(
    "/households",
    response_model=List[HouseholdRead],
    summary="Retrieve all households",
)
async def get_households(session: AsyncSession = Depends(get_db_session)):
    """Fetch all registered households from the database."""
    result = await session.execute(select(Household))
    return result.scalars().all()


@router.get(
    "/devices",
    response_model=List[DeviceRead],
    summary="Retrieve all devices with steps and history",
)
async def get_devices(
    household_id: Optional[int] = Query(default=None, description="Optional household filter"),
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch all devices.
    
    Includes related service steps and service history events.
    Supports filtering by household.
    """
    statement = select(Device).options(
        selectinload(Device.steps),
        selectinload(Device.history_events),
    )
    if household_id is not None:
        statement = statement.where(Device.household_id == household_id)
        
    result = await session.execute(statement)
    return result.scalars().all()


@router.post(
    "/devices",
    response_model=DeviceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new device with its initial maintenance steps",
)
async def create_device(
    payload: DeviceCreate,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a new Device record and insert all provided MaintenanceStep children
    inside a single atomic transaction. Rolls back fully on any validation error.
    """
    # Verify the target household exists
    household = await session.get(Household, payload.household_id)
    if not household:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Household {payload.household_id} not found",
        )

    # Insert Device row
    device = Device(
        name=payload.name,
        model=payload.model,
        serial=payload.serial,
        category=payload.category,
        location=payload.location,
        status=payload.status,
        service_interval_months=payload.service_interval_months,
        notes=payload.notes,
        household_id=payload.household_id,
    )
    session.add(device)
    # Flush to get the auto-generated device.id before inserting child steps
    await session.flush()

    # Insert MaintenanceStep children linked to this device
    for step_data in payload.steps:
        step = MaintenanceStep(
            title=step_data.title,
            description=step_data.description,
            recurrence=step_data.recurrence,
            supply_item=step_data.supply_item,
            device_id=device.id,
        )
        session.add(step)

    await session.commit()

    # Reload with relationships for the response
    await session.refresh(device)
    reloaded = await session.execute(
        select(Device)
        .options(selectinload(Device.steps), selectinload(Device.history_events))
        .where(Device.id == device.id)
    )
    return reloaded.scalar_one()
