from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel
from pydantic import Field as PydanticField
from sqlmodel import Field, SQLModel


class OverflowTarget(str, Enum):
    """Supported overflow targets for budget pots."""

    CASCADE = "CASCADE"  # Overflow excess amount to the next priority pot
    UNASSIGNED = "UNASSIGNED"  # Buffer unassigned funds
    INVESTMENT = "INVESTMENT"  # Transfer excess funds to investment pool


class PotBase(SQLModel):
    """Base SQLModel fields for virtual pot entity."""

    name: str = Field(index=True)
    priority: int = Field(default=1, index=True, ge=1, le=10)
    target_amount: Decimal | None = Field(default=None, decimal_places=2, max_digits=18)
    current_amount: Decimal = Field(default=Decimal("0.00"), decimal_places=2, max_digits=18)
    monthly_contribution: Decimal = Field(default=Decimal("0.00"), decimal_places=2, max_digits=18)
    target_date: date | None = Field(default=None)
    overflow_target: OverflowTarget = Field(default=OverflowTarget.CASCADE)
    is_active: bool = Field(default=True)


class Pot(PotBase, table=True):
    """Database model for virtual pots (buckets)."""

    __tablename__ = "pots"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    household_id: UUID = Field(index=True, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PotCreate(PotBase):
    """Pydantic model for pot creation request."""

    pass


class PotUpdate(BaseModel):
    """Pydantic model for updating pot details."""

    name: str | None = None
    priority: int | None = PydanticField(default=None, ge=1, le=10)
    target_amount: Decimal | None = None
    current_amount: Decimal | None = None
    monthly_contribution: Decimal | None = None
    target_date: date | None = None
    overflow_target: OverflowTarget | None = None
    is_active: bool | None = None


class PotRead(PotBase):
    """Pydantic model for pot response."""

    id: UUID
    household_id: UUID
    created_at: datetime
    updated_at: datetime


class CascadeAllocationRequest(BaseModel):
    """Request model for cascading fund allocation across pots."""

    amount: Decimal = PydanticField(gt=Decimal("0.00"))


class PotAllocationResult(BaseModel):
    """Allocation breakdown per pot during cascade execution."""

    pot_id: UUID
    pot_name: str
    priority: int
    allocated_amount: Decimal
    new_current_amount: Decimal
    target_amount: Decimal | None
    is_filled: bool


class CascadeAllocationResponse(BaseModel):
    """Summary response of priority cascade allocation execution."""

    total_allocated: Decimal
    remaining_unassigned: Decimal
    overflow_to_investment: Decimal
    allocations: list[PotAllocationResult]


class SinkingFundCalculationResponse(BaseModel):
    """Dynamic sinking fund gap calculation details for a pot."""

    pot_id: UUID
    pot_name: str
    target_amount: Decimal | None
    current_amount: Decimal
    shortfall: Decimal
    target_date: date | None
    remaining_months: int
    target_monthly_rate: Decimal
    actual_monthly_rate: Decimal
    gap: Decimal
    has_gap: bool
    status: str  # "WARNING", "ON_TRACK", "COMPLETED", or "NO_TARGET"


class MaintenanceReserveRequest(BaseModel):
    """Request payload from external services (e.g. maintenance app) to reserve funds."""

    title: str
    required_amount: Decimal = PydanticField(gt=Decimal("0.00"))
    due_date: date | None = None
    priority: int = PydanticField(default=1, ge=1, le=10)
