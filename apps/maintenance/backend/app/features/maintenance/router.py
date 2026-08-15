"""
Maintenance orchestration REST API router.

Exposes endpoints for the maintenance wizard session submission and aggregate summary,
delegating all execution to MaintenanceService.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
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
) -> WizardSessionResult:
    """Commit a full maintenance wizard session atomically."""
    try:
        return await MaintenanceService.submit_wizard_session(session, payload)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except (WizardValidationError, MaintenanceError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get(
    "/maintenance/summary",
    response_model=list[HouseholdMaintenanceSummary],
    summary="Return maintenance health summary grouped by household",
)
async def get_maintenance_summary(
    household_id: int | None = Query(
        default=None,
        description="Restrict results to a single household",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> list[HouseholdMaintenanceSummary]:
    """Return device maintenance health state summary grouped by household."""
    return await MaintenanceService.get_maintenance_summary(session, household_id=household_id)
