"""
Maintenance orchestration REST API router.

Exposes endpoints for the maintenance wizard session submission and aggregate summary,
delegating all execution to MaintenanceService.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import HouseholdContext, get_authorization, require_household
from app.features.devices.exceptions import DeviceNotFoundError
from app.features.maintenance.exceptions import MaintenanceError, WizardValidationError
from app.features.maintenance.schemas import (
    HouseholdMaintenanceSummary,
    WizardSessionPayload,
    WizardSessionResult,
)
from app.features.maintenance.service import MaintenanceService

router = APIRouter(prefix="/api/v1", tags=["maintenance"])


@router.post(
    "/maintenance/wizard",
    response_model=WizardSessionResult,
    status_code=status.HTTP_201_CREATED,
    summary="Commit a completed maintenance wizard session",
)
async def submit_wizard_session(
    payload: WizardSessionPayload,
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
    authorization: str | None = Depends(get_authorization),
) -> WizardSessionResult:
    """Commit a full maintenance wizard session atomically for a device of the current household."""
    try:
        return await MaintenanceService.submit_wizard_session(
            session, payload, household_id=context.household_id, authorization=authorization
        )
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (WizardValidationError, MaintenanceError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/maintenance/summary",
    response_model=list[HouseholdMaintenanceSummary],
    summary="Return the maintenance health summary of the current household",
)
async def get_maintenance_summary(
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
) -> list[HouseholdMaintenanceSummary]:
    """Return the device maintenance health summary of the household selected by ``X-Household-ID``."""
    return await MaintenanceService.get_maintenance_summary(session, household_id=context.household_id)
