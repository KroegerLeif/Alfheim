from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db_session
from app.features.devices.models import Household, Device
from app.features.devices.schemas import HouseholdRead, DeviceRead

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
