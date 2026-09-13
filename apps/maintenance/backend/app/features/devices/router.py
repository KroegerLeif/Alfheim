"""
Devices REST API router.

Exposes REST endpoints for devices and households, delegating all domain logic
to DeviceService.
"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import UserHouseholdContext, get_current_user_and_household
from app.features.devices.exceptions import DeviceError, DeviceNotFoundError, HouseholdNotFoundError
from app.features.devices.schemas import DeviceCreate, DeviceRead, HouseholdRead
from app.features.devices.service import DeviceService

router = APIRouter(prefix="/api/v1", tags=["devices"])


@router.get(
    "/households",
    response_model=list[HouseholdRead],
    summary="Retrieve all households",
)
async def get_households(
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Fetch households accessible by the authenticated user (scoped to their context)."""
    return await DeviceService.get_households(session, household_id=context.household_id)


@router.get(
    "/devices",
    response_model=list[DeviceRead],
    summary="Retrieve all devices with steps and history",
)
async def get_devices(
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Fetch all devices for the authenticated user's household with related service steps and history."""
    return await DeviceService.get_devices(session, household_id=context.household_id)


@router.get(
    "/devices/{device_id}",
    response_model=DeviceRead,
    summary="Retrieve a single device by ID",
)
async def get_device_by_id(
    device_id: int = Path(..., description="Device primary key"),
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Fetch a single device by ID along with its steps and service history.

    Returns 404 if the device does not exist or belongs to a different household.
    """
    try:
        return await DeviceService.get_device_by_id(
            session, device_id=device_id, household_id=context.household_id
        )
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
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Create a new Device record in the authenticated user's household.

    The device is assigned to the user's authenticated household regardless
    of any household_id supplied in the payload (enforcing tenant isolation).
    """
    try:
        return await DeviceService.create_device(session, payload, household_id=context.household_id)
    except HouseholdNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
