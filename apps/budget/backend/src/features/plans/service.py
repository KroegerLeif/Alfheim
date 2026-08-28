from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.plans.models import (
    PlanCategory,
    PlanCategoryCreate,
    PlanCategoryRead,
    PlanCategoryTreeRead,
    PlanCategoryUpdate,
    PlanCreate,
    PlanRead,
    PlanSummaryResponse,
    PlanUpdate,
)
from src.features.plans.repository import PlanRepository


class PlanService:
    """Service handling business logic for budget plans and categories."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = PlanRepository(session)

    async def create_plan(self, household_id: UUID, plan_in: PlanCreate) -> PlanRead:
        """Create a new budget plan."""
        plan = await self.repository.create_plan(household_id, plan_in)
        return PlanRead.model_validate(plan)

    async def get_plan(self, plan_id: UUID, household_id: UUID) -> PlanRead:
        """Get plan by ID or raise 404 HTTP Exception."""
        plan = await self.repository.get_plan_by_id(plan_id, household_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan {plan_id} not found",
            )
        return PlanRead.model_validate(plan)

    async def list_plans(self, household_id: UUID, include_inactive: bool = False) -> list[PlanRead]:
        """List all plans for a household."""
        plans = await self.repository.list_plans_by_household(household_id, include_inactive=include_inactive)
        return [PlanRead.model_validate(p) for p in plans]

    async def update_plan(self, plan_id: UUID, household_id: UUID, plan_update: PlanUpdate) -> PlanRead:
        """Update an existing budget plan."""
        plan = await self.repository.get_plan_by_id(plan_id, household_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan {plan_id} not found",
            )
        updated_plan = await self.repository.update_plan(plan, plan_update)
        return PlanRead.model_validate(updated_plan)

    async def delete_plan(self, plan_id: UUID, household_id: UUID) -> None:
        """Delete a plan and its associated categories."""
        plan = await self.repository.get_plan_by_id(plan_id, household_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan {plan_id} not found",
            )
        await self.repository.delete_plan(plan)

    async def create_category(
        self, plan_id: UUID, household_id: UUID, category_in: PlanCategoryCreate
    ) -> PlanCategoryRead:
        """Create a new category/subcategory under a plan."""
        # Ensure plan exists and belongs to household
        plan = await self.repository.get_plan_by_id(plan_id, household_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan {plan_id} not found",
            )

        # Validate parent_id if provided
        if category_in.parent_id:
            parent = await self.repository.get_category_by_id(category_in.parent_id, household_id)
            if not parent or parent.plan_id != plan_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent category does not exist or belongs to another plan",
                )

        category = await self.repository.create_category(household_id, plan_id, category_in)
        return PlanCategoryRead.model_validate(category)

    async def update_category(
        self, category_id: UUID, household_id: UUID, category_update: PlanCategoryUpdate
    ) -> PlanCategoryRead:
        """Update an existing category."""
        category = await self.repository.get_category_by_id(category_id, household_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category {category_id} not found",
            )

        if category_update.parent_id is not None:
            if category_update.parent_id == category.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Category cannot be its own parent",
                )
            parent = await self.repository.get_category_by_id(category_update.parent_id, household_id)
            if not parent or parent.plan_id != category.plan_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent category does not exist or belongs to another plan",
                )

        updated_category = await self.repository.update_category(category, category_update)
        return PlanCategoryRead.model_validate(updated_category)

    async def delete_category(self, category_id: UUID, household_id: UUID) -> None:
        """Delete a category from a plan."""
        category = await self.repository.get_category_by_id(category_id, household_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category {category_id} not found",
            )
        await self.repository.delete_category(category)

    async def get_plan_summary(self, plan_id: UUID, household_id: UUID) -> PlanSummaryResponse:
        """Calculate and return plan allocation summary and category hierarchy."""
        plan = await self.repository.get_plan_by_id(plan_id, household_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan {plan_id} not found",
            )

        categories = await self.repository.list_categories_by_plan(plan_id, household_id)
        total_allocated = sum((cat.allocated_amount for cat in categories), start=Decimal("0.00"))
        unallocated_balance = plan.total_budget - total_allocated

        category_tree = self._build_category_tree(categories)

        return PlanSummaryResponse(
            plan_id=plan.id,
            name=plan.name,
            plan_type=plan.plan_type,
            total_budget=plan.total_budget,
            total_allocated=total_allocated,
            unallocated_balance=unallocated_balance,
            categories_count=len(categories),
            categories=category_tree,
        )

    def _build_category_tree(self, categories: list[PlanCategory]) -> list[PlanCategoryTreeRead]:
        """Private helper to construct category hierarchy tree from flat categories list."""
        nodes: dict[UUID, PlanCategoryTreeRead] = {
            cat.id: PlanCategoryTreeRead(
                id=cat.id,
                plan_id=cat.plan_id,
                household_id=cat.household_id,
                name=cat.name,
                parent_id=cat.parent_id,
                allocated_amount=cat.allocated_amount,
                created_at=cat.created_at,
                updated_at=cat.updated_at,
                subcategories=[],
            )
            for cat in categories
        }

        roots: list[PlanCategoryTreeRead] = []
        for cat in categories:
            node = nodes[cat.id]
            if cat.parent_id and cat.parent_id in nodes:
                nodes[cat.parent_id].subcategories.append(node)
            else:
                roots.append(node)

        return roots
