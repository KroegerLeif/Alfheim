from collections.abc import Sequence
from datetime import UTC, date, datetime
from uuid import UUID

from sqlmodel import desc, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.transactions.models import (
    QuickAddTransactionCreate,
    Transaction,
    TransactionCreate,
    TransactionUpdate,
)


class TransactionRepository:
    """Repository handling database operations for Transaction entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        household_id: UUID,
        transaction_in: TransactionCreate | QuickAddTransactionCreate,
        is_quick_add: bool = False,
    ) -> Transaction:
        """Create a new Transaction record in the database."""
        data = transaction_in.model_dump()
        if isinstance(transaction_in, QuickAddTransactionCreate):
            data["is_quick_add"] = True
            if data.get("transaction_date") is None:
                data["transaction_date"] = date.today()
        else:
            data["is_quick_add"] = is_quick_add

        transaction = Transaction(
            household_id=household_id,
            **data,
        )
        self.session.add(transaction)
        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction

    async def get_by_id(self, transaction_id: UUID, household_id: UUID) -> Transaction | None:
        """Get a Transaction by ID filtered strictly by household_id."""
        statement = select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.household_id == household_id,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def list_by_household(
        self,
        household_id: UUID,
        account_id: UUID | None = None,
        pot_id: UUID | None = None,
        plan_id: UUID | None = None,
        category_id: UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Transaction]:
        """List transactions for a specific household with optional entity filters."""
        statement = select(Transaction).where(Transaction.household_id == household_id)
        if account_id is not None:
            statement = statement.where(Transaction.account_id == account_id)
        if pot_id is not None:
            statement = statement.where(Transaction.pot_id == pot_id)
        if plan_id is not None:
            statement = statement.where(Transaction.plan_id == plan_id)
        if category_id is not None:
            statement = statement.where(Transaction.category_id == category_id)

        statement = statement.order_by(desc(Transaction.transaction_date)).offset(offset).limit(limit)
        result = await self.session.exec(statement)
        return result.all()

    async def update(self, transaction: Transaction, transaction_update: TransactionUpdate) -> Transaction:
        """Update an existing Transaction entity."""
        update_data = transaction_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(transaction, field, value)
        transaction.updated_at = datetime.now(UTC)

        self.session.add(transaction)
        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction

    async def delete(self, transaction: Transaction) -> None:
        """Delete a transaction record from database."""
        await self.session.delete(transaction)
        await self.session.commit()
