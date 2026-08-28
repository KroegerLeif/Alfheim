from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class AccountType(str, Enum):
    """Supported account types in the budget domain."""

    CHECKING = "CHECKING"  # Checking / Current account
    SAVINGS = "SAVINGS"  # Savings account
    BUILDING_SAVINGS = "BUILDING_SAVINGS"  # Building savings account
    INVESTMENT = "INVESTMENT"  # Investment / Securities account (for Net-Worth tracking)


class AccountBase(SQLModel):
    """Base SQLModel fields for Account entity."""

    name: str = Field(index=True)
    account_type: AccountType = Field(index=True)
    balance: Decimal = Field(default=Decimal("0.00"), decimal_places=2, max_digits=18)
    currency: str = Field(default="EUR", max_length=3)
    target_amount: Decimal | None = Field(default=None, decimal_places=2, max_digits=18)
    maturity_date: date | None = Field(default=None)
    is_active: bool = Field(default=True)


class Account(AccountBase, table=True):
    """Database model for financial accounts."""

    __tablename__ = "accounts"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    household_id: UUID = Field(index=True, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AccountCreate(AccountBase):
    """Pydantic model for account creation request."""

    pass


class AccountUpdate(BaseModel):
    """Pydantic model for updating account details."""

    name: str | None = None
    account_type: AccountType | None = None
    balance: Decimal | None = None
    currency: str | None = None
    target_amount: Decimal | None = None
    maturity_date: date | None = None
    is_active: bool | None = None


class AccountRead(AccountBase):
    """Pydantic model for account response."""

    id: UUID
    household_id: UUID
    created_at: datetime
    updated_at: datetime


class BalanceSummaryResponse(BaseModel):
    """Summary of account balances grouped by account type."""

    total_balance: Decimal
    by_type: dict[AccountType, Decimal]


class NetWorthResponse(BaseModel):
    """Net worth aggregate calculation response."""

    liquid_assets: Decimal  # CHECKING + SAVINGS
    investments: Decimal  # INVESTMENT + BUILDING_SAVINGS
    total_net_worth: Decimal
    accounts_count: int
