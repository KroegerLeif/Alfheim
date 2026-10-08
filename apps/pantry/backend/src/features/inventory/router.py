import uuid
from collections.abc import Sequence
from datetime import datetime

from backend_shared.household import HouseholdContext, require_household
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.features.inventory.alert_service import AlertService
from src.features.inventory.ledger_service import LedgerService
from src.features.inventory.models import InventoryTransactionType
from src.features.inventory.schemas import (
    BulkAddInventoryPayload,
    BulkAddResponse,
    ExpirationSummary,
    InventoryLedgerRead,
    InventoryStateReadWithRelations,
    InventoryTransactionCreate,
    LowStockItem,
)
from src.features.inventory.service import InventoryService

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


@router.post(
    "/transactions",
    response_model=InventoryLedgerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new inventory transaction",
)
async def create_transaction(
    payload: InventoryTransactionCreate,
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Log a physical inventory movement (IN, OUT, WASTE, RECONCILIATION) with unit conversion."""
    return await InventoryService.create_transaction(
        session=session,
        payload=payload,
        home_id=context.household_id,
    )


@router.get(
    "/transactions",
    response_model=Sequence[InventoryLedgerRead],
    summary="Get inventory transaction history log",
)
async def get_ledger_history(
    product_id: uuid.UUID | None = Query(default=None, description="Filter by product UUID"),
    location_id: uuid.UUID | None = Query(default=None, description="Filter by location UUID"),
    transaction_type: list[InventoryTransactionType] | None = Query(
        default=None, description="Only return entries of these transaction types (repeatable)"
    ),
    date_from: datetime | None = Query(default=None, description="Only entries created at or after this instant"),
    date_to: datetime | None = Query(default=None, description="Only entries created before this instant"),
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Retrieve paginated inventory transaction log history for the current home space.

    Entries are returned newest first. Filter by product, location, transaction type and a
    ``date_from`` (inclusive) / ``date_to`` (exclusive) range, and page with ``limit``/``offset``.
    """
    return await LedgerService.get_ledger_history(
        session=session,
        home_id=context.household_id,
        product_id=product_id,
        location_id=location_id,
        limit=limit,
        offset=offset,
        date_from=date_from,
        date_to=date_to,
        transaction_types=transaction_type,
    )


@router.get(
    "/state",
    response_model=Sequence[InventoryStateReadWithRelations],
    summary="Get current cached inventory stock levels",
)
async def get_current_state(
    product_id: uuid.UUID | None = Query(default=None, description="Filter by product UUID"),
    location_id: uuid.UUID | None = Query(default=None, description="Filter by location UUID"),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Retrieve the real-time cached inventory levels, including nested product and location details."""
    return await InventoryService.get_current_state(
        session=session,
        home_id=context.household_id,
        product_id=product_id,
        location_id=location_id,
    )


@router.get(
    "/low-stock",
    response_model=Sequence[LowStockItem],
    summary="Get low stock products",
)
async def get_low_stock_items(
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Retrieve products that are below their minimum stock thresholds for the current home space."""
    return await AlertService.get_low_stock_items(
        session=session,
        home_id=context.household_id,
    )


@router.get(
    "/expiration-summary",
    response_model=ExpirationSummary,
    summary="Get inventory expiration date summary status",
)
async def get_expiration_summary(
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Retrieve summary of inventory items categorized by their expiration status (Expired, Valid, Untracked)."""
    return await AlertService.get_expiration_summary(
        session=session,
        home_id=context.household_id,
    )


@router.post(
    "/bulk-add",
    response_model=BulkAddResponse,
    status_code=status.HTTP_200_OK,
    summary="Record bulk inventory stock additions from shopping list",
)
async def bulk_add_items(
    payload: BulkAddInventoryPayload,
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Sync completed items from the Shopping App into the digital pantry in bulk."""
    return await InventoryService.bulk_add_items(
        session=session,
        payload=payload,
        home_id=context.household_id,
    )
