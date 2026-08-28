from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.accounts.models import Account, AccountCreate, AccountUpdate


class AccountRepository:
    """Repository handling database operations for Account entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, household_id: UUID, account_in: AccountCreate) -> Account:
        """Create a new Account record in database."""
        account = Account(
            household_id=household_id,
            **account_in.model_dump(),
        )
        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)
        return account

    async def get_by_id(self, account_id: UUID, household_id: UUID) -> Account | None:
        """Get an Account by ID filtered by household_id."""
        statement = select(Account).where(
            Account.id == account_id,
            Account.household_id == household_id,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def list_by_household(self, household_id: UUID, include_inactive: bool = False) -> Sequence[Account]:
        """List all accounts for a specific household."""
        statement = select(Account).where(Account.household_id == household_id)
        if not include_inactive:
            statement = statement.where(Account.is_active.is_(True))
        result = await self.session.exec(statement)
        return result.all()

    async def update(self, account: Account, account_update: AccountUpdate) -> Account:
        """Update an existing Account entity."""
        update_data = account_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(account, field, value)
        account.updated_at = datetime.now(UTC)

        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)
        return account

    async def delete(self, account: Account) -> None:
        """Delete an account record from database."""
        await self.session.delete(account)
        await self.session.commit()
