"""Devices REST API router.

Exposes REST endpoints for devices and the current household, delegating all domain
logic to DeviceService.
"""

from backend_shared.household.permissions import require_writer
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import HouseholdContext, require_household
from app.features.devices.exceptions import DeviceError, DeviceNotFoundError, DeviceStepNotFoundError
from app.features.devices.schemas import (
    DeviceCreate,
    DeviceRead,
    DeviceUpdate,
    HouseholdRead,
    MaintenanceStepRead,
    StepCreate,
    StepUpdate,
)
from app.features.devices.service import DeviceService

router = APIRouter(prefix="/api/v1", tags=["devices"])

#: Placeholder name for the household of the current request. Household names live in
#: core/household; this endpoint only exists so existing clients can group devices.
CURRENT_HOUSEHOLD_NAME = "Household"


@router.get(
    "/households",
    response_model=list[HouseholdRead],
    summary="Retrieve the household of the current request",
    deprecated=True,
)
async def get_households(
    context: HouseholdContext = Depends(require_household),
):
    """Return the household selected by ``X-Household-ID`` (the caller is a confirmed member).

    Deprecated: households, their names and members are owned by the household app
    (core/household); clients should read them there.
    """
    return [HouseholdRead(id=context.household_id, name=CURRENT_HOUSEHOLD_NAME)]


@router.get(
    "/devices",
    response_model=list[DeviceRead],
    summary="Retrieve all devices with steps and history",
)
async def get_devices(
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
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
    context: HouseholdContext = Depends(require_household),
):
    """Fetch a single device by ID along with its steps and service history.

    Returns 404 if the device does not exist or belongs to a different household.
    """
    try:
        return await DeviceService.get_device_by_id(session, device_id=device_id, household_id=context.household_id)
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
    context: HouseholdContext = Depends(require_writer),
):
    """Create a new Device record in the household selected by ``X-Household-ID``.

    Any household_id supplied in the payload is ignored (tenant isolation).
    """
    try:
        return await DeviceService.create_device(session, payload, household_id=context.household_id)
    except DeviceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch(
    "/devices/{device_id}",
    response_model=DeviceRead,
    summary="Update a device's details",
)
async def update_device(
    payload: DeviceUpdate,
    device_id: int = Path(..., description="Device primary key"),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_writer),
):
    """Change the fields sent in the body; omitted fields keep their value.

    Returns 404 if the device does not exist or belongs to a different household, and 422 for an
    explicit null on a required field.
    """
    try:
        return await DeviceService.update_device(session, device_id, payload, household_id=context.household_id)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a device with its maintenance steps and service history",
)
async def delete_device(
    device_id: int = Path(..., description="Device primary key"),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_writer),
) -> Response:
    """Remove a retired device. Returns 404 if it does not exist or belongs to a different household."""
    try:
        await DeviceService.delete_device(session, device_id, household_id=context.household_id)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/devices/{device_id}/steps",
    response_model=MaintenanceStepRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a maintenance step to a device",
)
async def add_step(
    payload: StepCreate,
    device_id: int = Path(..., description="Device primary key"),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_writer),
):
    """Add a step; its first due date is one interval from today. 404 for a foreign or unknown device."""
    try:
        return await DeviceService.add_step(session, device_id, payload, household_id=context.household_id)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch(
    "/devices/{device_id}/steps/{step_id}",
    response_model=MaintenanceStepRead,
    summary="Edit a maintenance step of a device",
)
async def update_step(
    payload: StepUpdate,
    device_id: int = Path(..., description="Device primary key"),
    step_id: int = Path(..., description="Maintenance step primary key"),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_writer),
):
    """Change the title, procedure, interval or supply item of a step; a new interval moves the due date."""
    try:
        return await DeviceService.update_step(session, device_id, step_id, payload, household_id=context.household_id)
    except DeviceStepNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/devices/{device_id}/steps/{step_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a maintenance step from a device",
)
async def delete_step(
    device_id: int = Path(..., description="Device primary key"),
    step_id: int = Path(..., description="Maintenance step primary key"),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_writer),
) -> Response:
    """Delete a step. Returns 404 if it does not exist on that device of the household."""
    try:
        await DeviceService.delete_step(session, device_id, step_id, household_id=context.household_id)
    except DeviceStepNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
