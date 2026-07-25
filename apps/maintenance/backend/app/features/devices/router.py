"""
Devices REST API router.

Exposes REST endpoints for devices and households, delegating all domain logic
to DeviceService.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
from app.features.devices.schemas import HouseholdRead, DeviceRead, DeviceCreate
from app.features.devices.service import DeviceService
from app.features.devices.exceptions import DeviceNotFoundError, HouseholdNotFoundError, DeviceError

router = APIRouter(prefix="/api/v1", tags=["devices"])


@router.get(
    "/households",
    response_model=List[HouseholdRead],
    summary="Retrieve all households",
)
async def get_households(session: AsyncSession = Depends(get_db_session)):
    """Fetch all registered households from the database."""
    return await DeviceService.get_households(session)


@router.get(
    "/devices",
    response_model=List[DeviceRead],
    summary="Retrieve all devices with steps and history",
)
async def get_devices(
    household_id: Optional[int] = Query(default=None, description="Optional household filter"),
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch all devices with related service steps and service history events."""
    return await DeviceService.get_devices(session, household_id=household_id)


@router.get(
    "/devices/{device_id}",
    response_model=DeviceRead,
    summary="Retrieve a single device by ID",
)
async def get_device_by_id(
    device_id: int = Path(..., description="Device primary key"),
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch a single device by ID along with its steps and service history."""
    try:
        return await DeviceService.get_device_by_id(session, device_id=device_id)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


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
    """Create a new Device record and insert all provided MaintenanceStep children."""
    try:
        return await DeviceService.create_device(session, payload)
    except HouseholdNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
