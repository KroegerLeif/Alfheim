from collections.abc import Sequence
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from src.features.accounts.models import (
    Account,
    AccountCreate,
    AccountType,
    AccountUpdate,
    BalanceSummaryResponse,
    NetWorthResponse,
)
from src.features.accounts.repository import AccountRepository


class AccountService:
    """Service handling business logic and aggregate calculations for accounts."""

    def __init__(self, repository: AccountRepository) -> None:
        self.repository = repository

    async def create_account(self, household_id: UUID, account_in: AccountCreate) -> Account:
        """Create a new account for the specified household."""
        return await self.repository.create(household_id=household_id, account_in=account_in)

    async def get_account(self, account_id: UUID, household_id: UUID) -> Account:
        """Retrieve an account by ID, raising 404 if missing or unauthorized."""
        account = await self.repository.get_by_id(account_id=account_id, household_id=household_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )
        return account

    async def list_accounts(self, household_id: UUID, include_inactive: bool = False) -> Sequence[Account]:
        """List accounts for household."""
        return await self.repository.list_by_household(household_id=household_id, include_inactive=include_inactive)

    async def update_account(self, account_id: UUID, household_id: UUID, account_update: AccountUpdate) -> Account:
        """Update an existing account for the specified household."""
        account = await self.get_account(account_id=account_id, household_id=household_id)
        return await self.repository.update(account=account, account_update=account_update)

    async def delete_account(self, account_id: UUID, household_id: UUID) -> None:
        """Delete an account for the specified household."""
        account = await self.get_account(account_id=account_id, household_id=household_id)
        await self.repository.delete(account=account)

    async def get_balance_summary(self, household_id: UUID) -> BalanceSummaryResponse:
        """Calculate balance aggregates grouped by account type."""
        accounts = await self.repository.list_by_household(household_id=household_id)
        by_type = self._calculate_balance_aggregates(accounts)
        total_balance = sum(by_type.values(), Decimal("0.00"))
        return BalanceSummaryResponse(total_balance=total_balance, by_type=by_type)

    async def get_net_worth_summary(self, household_id: UUID) -> NetWorthResponse:
        """Calculate total net worth breakdown for liquid assets and investments."""
        accounts = await self.repository.list_by_household(household_id=household_id)
        return self._calculate_net_worth(accounts)

    def _calculate_balance_aggregates(self, accounts: Sequence[Account]) -> dict[AccountType, Decimal]:
        """Private helper function calculating total balance per AccountType."""
        aggregates: dict[AccountType, Decimal] = {account_type: Decimal("0.00") for account_type in AccountType}
        for acc in accounts:
            aggregates[acc.account_type] += acc.balance
        return aggregates

    def _calculate_net_worth(self, accounts: Sequence[Account]) -> NetWorthResponse:
        """Private helper function calculating liquid assets, investments, and net worth."""
        liquid = Decimal("0.00")
        investments = Decimal("0.00")

        for acc in accounts:
            if acc.account_type in (AccountType.CHECKING, AccountType.SAVINGS):
                liquid += acc.balance
            elif acc.account_type in (AccountType.INVESTMENT, AccountType.BUILDING_SAVINGS):
                investments += acc.balance

        return NetWorthResponse(
            liquid_assets=liquid,
            investments=investments,
            total_net_worth=liquid + investments,
            accounts_count=len(accounts),
        )
