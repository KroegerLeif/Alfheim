from collections.abc import Sequence
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import TenantContext, get_current_tenant, get_db_session
from src.features.pots.models import (
    CascadeAllocationRequest,
    CascadeAllocationResponse,
    MaintenanceReserveRequest,
    PotCreate,
    PotRead,
    PotUpdate,
    SinkingFundCalculationResponse,
)
from src.features.pots.repository import PotRepository
from src.features.pots.service import PotService

router = APIRouter()


def get_pot_service(
    session: AsyncSession = Depends(get_db_session),
) -> PotService:
    """Dependency helper to instantiate PotService with session repository."""
    repository = PotRepository(session)
    return PotService(repository)


@router.post("/", response_model=PotRead, status_code=status.HTTP_201_CREATED)
async def create_pot(
    pot_in: PotCreate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> PotRead:
    """Create a new virtual pot for the authenticated household."""
    pot = await service.create_pot(
        household_id=tenant.household_id,
        pot_in=pot_in,
    )
    return PotRead.model_validate(pot)


@router.get("/", response_model=list[PotRead])
async def list_pots(
    include_inactive: bool = Query(default=False),
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> Sequence[PotRead]:
    """List all pots for the authenticated household."""
    pots = await service.list_pots(
        household_id=tenant.household_id,
        include_inactive=include_inactive,
    )
    return [PotRead.model_validate(p) for p in pots]


@router.post("/cascade", response_model=CascadeAllocationResponse)
async def allocate_cascade(
    req: CascadeAllocationRequest,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> CascadeAllocationResponse:
    """Distribute amount across pots in order of priority cascade."""
    return await service.allocate_cascade(
        household_id=tenant.household_id,
        amount=req.amount,
    )


@router.post("/maintenance-reserve", response_model=PotRead, status_code=status.HTTP_201_CREATED)
async def create_maintenance_reserve(
    req: MaintenanceReserveRequest,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> PotRead:
    """Receive maintenance reserve request from external apps (e.g. maintenance service)."""
    return await service.create_maintenance_reserve(
        household_id=tenant.household_id,
        req=req,
    )


@router.get("/{pot_id}", response_model=PotRead)
async def get_pot(
    pot_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> PotRead:
    """Get pot details by ID for active household."""
    pot = await service.get_pot(
        pot_id=pot_id,
        household_id=tenant.household_id,
    )
    return PotRead.model_validate(pot)


@router.get("/{pot_id}/sinking-fund-calculator", response_model=SinkingFundCalculationResponse)
async def calculate_sinking_fund_gap(
    pot_id: UUID,
    reference_date: date | None = Query(default=None),
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> SinkingFundCalculationResponse:
    """Calculate sinking fund dynamic target rate, actual rate, and gap warning status."""
    return await service.calculate_sinking_fund_gap(
        pot_id=pot_id,
        household_id=tenant.household_id,
        reference_date=reference_date,
    )


@router.patch("/{pot_id}", response_model=PotRead)
async def update_pot(
    pot_id: UUID,
    pot_update: PotUpdate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> PotRead:
    """Update an existing pot for active household."""
    pot = await service.update_pot(
        pot_id=pot_id,
        household_id=tenant.household_id,
        pot_update=pot_update,
    )
    return PotRead.model_validate(pot)


@router.delete("/{pot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pot(
    pot_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PotService = Depends(get_pot_service),
) -> None:
    """Delete a pot for active household."""
    await service.delete_pot(
        pot_id=pot_id,
        household_id=tenant.household_id,
    )
