from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.pots.models import Pot, PotCreate, PotUpdate


class PotRepository:
    """Repository handling database operations for Pot entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, household_id: UUID, pot_in: PotCreate) -> Pot:
        """Create a new Pot record in the database."""
        pot = Pot(
            household_id=household_id,
            **pot_in.model_dump(),
        )
        self.session.add(pot)
        await self.session.commit()
        await self.session.refresh(pot)
        return pot

    async def get_by_id(self, pot_id: UUID, household_id: UUID) -> Pot | None:
        """Get a Pot by ID filtered strictly by household_id."""
        statement = select(Pot).where(
            Pot.id == pot_id,
            Pot.household_id == household_id,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def get_by_name(self, name: str, household_id: UUID) -> Pot | None:
        """Get an active Pot by name filtered by household_id."""
        statement = select(Pot).where(
            Pot.name == name,
            Pot.household_id == household_id,
            Pot.is_active.is_(True),
        )
        result = await self.session.exec(statement)
        return result.first()

    async def list_by_household(self, household_id: UUID, include_inactive: bool = False) -> Sequence[Pot]:
        """List all pots for a specific household."""
        statement = select(Pot).where(Pot.household_id == household_id)
        if not include_inactive:
            statement = statement.where(Pot.is_active.is_(True))
        result = await self.session.exec(statement)
        return result.all()

    async def list_ordered_by_priority(self, household_id: UUID) -> Sequence[Pot]:
        """List active pots for a household ordered by priority (1 to 10) then created_at."""
        statement = (
            select(Pot)
            .where(
                Pot.household_id == household_id,
                Pot.is_active.is_(True),
            )
            .order_by(Pot.priority.asc(), Pot.created_at.asc())
        )
        result = await self.session.exec(statement)
        return result.all()

    async def update(self, pot: Pot, pot_update: PotUpdate) -> Pot:
        """Update an existing Pot entity."""
        update_data = pot_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(pot, field, value)
        pot.updated_at = datetime.now(UTC)

        self.session.add(pot)
        await self.session.commit()
        await self.session.refresh(pot)
        return pot

    async def delete(self, pot: Pot) -> None:
        """Delete a pot record from the database."""
        await self.session.delete(pot)
        await self.session.commit()
