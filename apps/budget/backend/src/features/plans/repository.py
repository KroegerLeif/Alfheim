from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.plans.models import (
    Plan,
    PlanCategory,
    PlanCategoryCreate,
    PlanCategoryUpdate,
    PlanCreate,
    PlanUpdate,
)


class PlanRepository:
    """Repository handling database operations for Plan and PlanCategory entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_plan(self, household_id: UUID, plan_in: PlanCreate) -> Plan:
        """Create a new Plan record in database."""
        plan = Plan(
            household_id=household_id,
            **plan_in.model_dump(),
        )
        self.session.add(plan)
        await self.session.commit()
        await self.session.refresh(plan)
        return plan

    async def get_plan_by_id(self, plan_id: UUID, household_id: UUID) -> Plan | None:
        """Get a Plan by ID filtered strictly by household_id."""
        statement = select(Plan).where(
            Plan.id == plan_id,
            Plan.household_id == household_id,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def list_plans_by_household(self, household_id: UUID, include_inactive: bool = False) -> Sequence[Plan]:
        """List all plans for a specific household."""
        statement = select(Plan).where(Plan.household_id == household_id)
        if not include_inactive:
            statement = statement.where(Plan.is_active == True)  # noqa: E712
        result = await self.session.exec(statement)
        return result.all()

    async def update_plan(self, plan: Plan, plan_update: PlanUpdate) -> Plan:
        """Update an existing Plan entity."""
        update_data = plan_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(plan, field, value)
        plan.updated_at = datetime.now(UTC)

        self.session.add(plan)
        await self.session.commit()
        await self.session.refresh(plan)
        return plan

    async def delete_plan(self, plan: Plan) -> None:
        """Delete a plan record from database along with its categories."""
        categories = await self.list_categories_by_plan(plan.id, plan.household_id)
        for category in categories:
            await self.session.delete(category)

        await self.session.delete(plan)
        await self.session.commit()

    async def create_category(self, household_id: UUID, plan_id: UUID, category_in: PlanCategoryCreate) -> PlanCategory:
        """Create a new PlanCategory record in database."""
        category = PlanCategory(
            household_id=household_id,
            plan_id=plan_id,
            **category_in.model_dump(),
        )
        self.session.add(category)
        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def get_category_by_id(self, category_id: UUID, household_id: UUID) -> PlanCategory | None:
        """Get a PlanCategory by ID filtered strictly by household_id."""
        statement = select(PlanCategory).where(
            PlanCategory.id == category_id,
            PlanCategory.household_id == household_id,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def list_categories_by_plan(self, plan_id: UUID, household_id: UUID) -> Sequence[PlanCategory]:
        """List all categories belonging to a plan."""
        statement = select(PlanCategory).where(
            PlanCategory.plan_id == plan_id,
            PlanCategory.household_id == household_id,
        )
        result = await self.session.exec(statement)
        return result.all()

    async def update_category(self, category: PlanCategory, category_update: PlanCategoryUpdate) -> PlanCategory:
        """Update an existing PlanCategory entity."""
        update_data = category_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(category, field, value)
        category.updated_at = datetime.now(UTC)

        self.session.add(category)
        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def delete_category(self, category: PlanCategory) -> None:
        """Delete a PlanCategory record from database and handle child categories."""
        # Reset parent_id of direct child categories
        statement = select(PlanCategory).where(
            PlanCategory.parent_id == category.id,
            PlanCategory.household_id == category.household_id,
        )
        result = await self.session.exec(statement)
        children = result.all()
        for child in children:
            child.parent_id = None
            child.updated_at = datetime.now(UTC)
            self.session.add(child)

        await self.session.delete(category)
        await self.session.commit()
