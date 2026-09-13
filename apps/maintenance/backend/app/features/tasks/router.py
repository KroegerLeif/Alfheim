"""
Tasks REST API router.

Exposes REST endpoints for service history, submission, and step updates,
delegating all logic to TaskService.
"""

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import UserHouseholdContext, get_current_user_and_household
from app.features.devices.exceptions import DeviceNotFoundError
from app.features.devices.schemas import MaintenanceStepRead, ServiceHistoryEventDetailRead, ServiceHistoryEventRead
from app.features.tasks.exceptions import InvalidStepError, StepNotFoundError
from app.features.tasks.schemas import MaintenanceSubmission, TaskStateUpdate
from app.features.tasks.service import TaskService

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
    """Log a new service history event for the authenticated user's household.

    The device must belong to the user's authenticated household.
    """
    try:
        return await TaskService.submit_maintenance_wizard(
            session, payload, household_id=context.household_id
        )
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InvalidStepError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/history",
    response_model=list[ServiceHistoryEventDetailRead],
    summary="Retrieve service history events sorted newest first",
)
async def get_service_history(
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Fetch all ServiceHistoryEvent records for the authenticated user's household, sorted newest first."""
    return await TaskService.get_history(session, household_id=context.household_id)


@router.post(
    "/tasks/{step_id}/state",
    response_model=MaintenanceStepRead,
    summary="Save an individual step's inspection comment or property overrides",
)
async def update_task_state(
    step_id: int = Path(..., description="The MaintenanceStep primary key"),
    payload: TaskStateUpdate = Body(...),
    session: AsyncSession = Depends(get_db_session),
    context: UserHouseholdContext = Depends(get_current_user_and_household),
):
    """Persist lightweight step updates from ScheduledView accordion.

    The step must belong to the authenticated user's household.
    """
    try:
        return await TaskService.update_task_state(
            session, step_id, payload, household_id=context.household_id
        )
    except StepNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
