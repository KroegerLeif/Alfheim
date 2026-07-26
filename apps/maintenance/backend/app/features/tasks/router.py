"""
Tasks REST API router.

Exposes REST endpoints for service history, submission, and step updates,
delegating all logic to TaskService.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import get_current_user_and_household, UserHouseholdContext
from app.features.devices.exceptions import DeviceNotFoundError
from app.features.tasks.schemas import MaintenanceSubmission, TaskStateUpdate
from app.features.devices.schemas import ServiceHistoryEventRead, ServiceHistoryEventDetailRead, MaintenanceStepRead
from app.features.tasks.service import TaskService
from app.features.tasks.exceptions import StepNotFoundError, InvalidStepError

router = APIRouter(prefix="/api/v1", tags=["tasks"])


@router.post(
    "/submit",
    response_model=ServiceHistoryEventRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit maintenance logs and update steps",
)
async def submit_maintenance(
    payload: MaintenanceSubmission,
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Log a new service history event and update completed steps' due dates."""
    try:
        return await TaskService.submit_maintenance_wizard(session, payload)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InvalidStepError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/history",
    response_model=List[ServiceHistoryEventDetailRead],
    summary="Retrieve service history events sorted newest first",
)
async def get_service_history(
    household_id: Optional[int] = Query(default=None, description="Optional household filter"),
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Fetch all ServiceHistoryEvent records joined with their Device."""
    target_hh = household_id if household_id is not None else context.household_id
    return await TaskService.get_history(session, household_id=target_hh)


@router.post(
    "/tasks/{step_id}/state",
    response_model=MaintenanceStepRead,
    summary="Save an individual step's inspection comment or property overrides",
)
async def update_task_state(
    step_id: int = Path(..., description="The MaintenanceStep primary key"),
    payload: TaskStateUpdate = ...,
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Persist lightweight step updates from ScheduledView accordion."""
    try:
        return await TaskService.update_task_state(session, step_id, payload)
    except StepNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
