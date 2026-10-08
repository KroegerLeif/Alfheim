import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.inventory.models import InventoryLedger, InventoryTransactionType
from src.features.locations.models import Location


def _as_utc(value: datetime) -> datetime:
    """Interpret naive datetimes as UTC and convert aware ones to UTC, matching how the ledger stores them."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


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
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        transaction_types: Sequence[InventoryTransactionType] | None = None,
    ) -> Sequence[InventoryLedger]:
        """Retrieve historical transaction log entries, ensuring home space boundaries.

        ``date_from`` is inclusive and ``date_to`` exclusive, so adjacent periods never overlap.
        Entries are ordered newest first with the id as a tie-breaker, which keeps offset paging stable.
        """
        statement = (
            select(InventoryLedger)
            .join(Location, col(Location.id) == InventoryLedger.location_id)
            .where(Location.home_id == home_id)
        )

        if product_id:
            statement = statement.where(InventoryLedger.product_id == product_id)
        if location_id:
            statement = statement.where(InventoryLedger.location_id == location_id)

        if date_from is not None:
            statement = statement.where(col(InventoryLedger.created_at) >= _as_utc(date_from))
        if date_to is not None:
            statement = statement.where(col(InventoryLedger.created_at) < _as_utc(date_to))
        if transaction_types:
            statement = statement.where(col(InventoryLedger.transaction_type).in_([t.value for t in transaction_types]))

        statement = (
            statement.order_by(col(InventoryLedger.created_at).desc(), col(InventoryLedger.id).desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.exec(statement)
        return result.all()
