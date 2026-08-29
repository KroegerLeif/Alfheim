from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import TenantContext, get_current_tenant, get_db_session
from src.features.plans.models import (
    PlanCategoryCreate,
    PlanCategoryRead,
    PlanCategoryUpdate,
    PlanCreate,
    PlanRead,
    PlanSummaryResponse,
    PlanUpdate,
)
from src.features.plans.service import PlanService

router = APIRouter()


def get_plan_service(
    session: AsyncSession = Depends(get_db_session),
) -> PlanService:
    """Dependency helper to instantiate PlanService with session."""
    return PlanService(session)


@router.post("/", response_model=PlanRead, status_code=status.HTTP_201_CREATED)
async def create_plan(
    plan_in: PlanCreate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> PlanRead:
    """Create a new budget plan for the authenticated household."""
    return await service.create_plan(
        household_id=tenant.household_id,
        plan_in=plan_in,
    )


@router.get("/", response_model=list[PlanRead])
async def list_plans(
    include_inactive: bool = Query(default=False),
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> list[PlanRead]:
    """List all budget plans for the authenticated household."""
    return await service.list_plans(
        household_id=tenant.household_id,
        include_inactive=include_inactive,
    )


@router.get("/{plan_id}", response_model=PlanRead)
async def get_plan(
    plan_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> PlanRead:
    """Get budget plan details by ID for the active household."""
    return await service.get_plan(
        plan_id=plan_id,
        household_id=tenant.household_id,
    )


@router.patch("/{plan_id}", response_model=PlanRead)
async def update_plan(
    plan_id: UUID,
    plan_update: PlanUpdate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> PlanRead:
    """Update an existing budget plan for the active household."""
    return await service.update_plan(
        plan_id=plan_id,
        household_id=tenant.household_id,
        plan_update=plan_update,
    )


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> None:
    """Delete a budget plan for the active household."""
    await service.delete_plan(
        plan_id=plan_id,
        household_id=tenant.household_id,
    )


@router.get("/{plan_id}/summary", response_model=PlanSummaryResponse)
async def get_plan_summary(
    plan_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> PlanSummaryResponse:
    """Get allocation summary and category hierarchy tree for a plan."""
    return await service.get_plan_summary(
        plan_id=plan_id,
        household_id=tenant.household_id,
    )


@router.post(
    "/{plan_id}/categories",
    response_model=PlanCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    plan_id: UUID,
    category_in: PlanCategoryCreate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> PlanCategoryRead:
    """Create a new category or subcategory under a plan."""
    return await service.create_category(
        plan_id=plan_id,
        household_id=tenant.household_id,
        category_in=category_in,
    )


@router.patch("/categories/{category_id}", response_model=PlanCategoryRead)
async def update_category(
    category_id: UUID,
    category_update: PlanCategoryUpdate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> PlanCategoryRead:
    """Update an existing category or subcategory."""
    return await service.update_category(
        category_id=category_id,
        household_id=tenant.household_id,
        category_update=category_update,
    )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: PlanService = Depends(get_plan_service),
) -> None:
    """Delete a category from a plan."""
    await service.delete_category(
        category_id=category_id,
        household_id=tenant.household_id,
    )
