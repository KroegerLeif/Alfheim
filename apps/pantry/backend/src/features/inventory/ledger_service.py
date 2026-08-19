import uuid
from collections.abc import Sequence

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.inventory.models import InventoryLedger
from src.features.locations.models import Location


class LedgerService:
    """Service class encapsulating ledger tracking, transaction logs, and history management."""

    @staticmethod
    async def get_ledger_history(
        session: AsyncSession,
        home_id: uuid.UUID,
        product_id: uuid.UUID | None = None,
        location_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[InventoryLedger]:
        """Retrieve historical transaction log entries, ensuring home space boundaries."""
        statement = (
            select(InventoryLedger)
            .join(Location, col(Location.id) == InventoryLedger.location_id)
            .where(Location.home_id == home_id)
        )

        if product_id:
            statement = statement.where(InventoryLedger.product_id == product_id)
        if location_id:
            statement = statement.where(InventoryLedger.location_id == location_id)

        statement = statement.order_by(col(InventoryLedger.created_at).desc()).offset(offset).limit(limit)
        result = await session.exec(statement)
        return result.all()
