from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class PlanType(str, Enum):
    """Supported plan types in the budget domain."""

    MONTHLY = "MONTHLY"  # Recurring monthly budget allocation
    EVENT = "EVENT"  # Project-based budget allocation (e.g. Relocation, Wedding)


class PlanBase(SQLModel):
    """Base SQLModel fields for budget plan entity."""

    name: str = Field(index=True)
    description: str | None = Field(default=None)
    plan_type: PlanType = Field(index=True)
    start_date: date | None = Field(default=None)
    end_date: date | None = Field(default=None)
    total_budget: Decimal = Field(default=Decimal("0.00"), decimal_places=2, max_digits=18)
    is_active: bool = Field(default=True)


class Plan(PlanBase, table=True):
    """Database model for budget plans."""

    __tablename__ = "plans"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    household_id: UUID = Field(index=True, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PlanCreate(PlanBase):
    """Pydantic model for plan creation request."""

    pass


class PlanUpdate(BaseModel):
    """Pydantic model for updating plan details."""

    name: str | None = None
    description: str | None = None
    plan_type: PlanType | None = None
    start_date: date | None = None
    end_date: date | None = None
    total_budget: Decimal | None = None
    is_active: bool | None = None


class PlanRead(PlanBase):
    """Pydantic model for plan response."""

    id: UUID
    household_id: UUID
    created_at: datetime
    updated_at: datetime


class PlanCategoryBase(SQLModel):
    """Base SQLModel fields for plan category entity."""

    name: str = Field(index=True)
    parent_id: UUID | None = Field(default=None, foreign_key="plan_categories.id", index=True)
    allocated_amount: Decimal = Field(default=Decimal("0.00"), decimal_places=2, max_digits=18)


class PlanCategory(PlanCategoryBase, table=True):
    """Database model for plan categories and subcategories."""

    __tablename__ = "plan_categories"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    plan_id: UUID = Field(foreign_key="plans.id", index=True, nullable=False)
    household_id: UUID = Field(index=True, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PlanCategoryCreate(PlanCategoryBase):
    """Pydantic model for category creation request within a plan."""

    pass


class PlanCategoryUpdate(BaseModel):
    """Pydantic model for updating category details."""

    name: str | None = None
    parent_id: UUID | None = None
    allocated_amount: Decimal | None = None


class PlanCategoryRead(PlanCategoryBase):
    """Pydantic model for category response."""

    id: UUID
    plan_id: UUID
    household_id: UUID
    created_at: datetime
    updated_at: datetime


class PlanCategoryTreeRead(PlanCategoryRead):
    """Pydantic model for category response including subcategories hierarchy."""

    subcategories: list["PlanCategoryTreeRead"] = []


class PlanSummaryResponse(BaseModel):
    """Summary response for plan allocation breakdown."""

    plan_id: UUID
    name: str
    plan_type: PlanType
    total_budget: Decimal
    total_allocated: Decimal
    unallocated_balance: Decimal
    categories_count: int
    categories: list[PlanCategoryTreeRead]
