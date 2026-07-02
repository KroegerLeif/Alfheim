import uuid
from typing import Optional, Sequence
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import get_current_user_and_home, UserHomeContext
from src.features.inventory.service import InventoryService
from src.features.inventory.schemas import (
    InventoryTransactionCreate,
    InventoryLedgerRead,
    InventoryStateReadWithRelations,
    LowStockItem,
    ExpirationSummary,
)

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
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Log a physical inventory movement (IN, OUT, WASTE, RECONCILIATION) with unit conversion."""
    return await InventoryService.create_transaction(
        session=session,
        payload=payload,
        home_id=context.home_id,
    )


@router.get(
    "/transactions",
    response_model=Sequence[InventoryLedgerRead],
    summary="Get inventory transaction history log",
)
async def get_ledger_history(
    product_id: Optional[uuid.UUID] = Query(default=None, description="Filter by product UUID"),
    location_id: Optional[uuid.UUID] = Query(default=None, description="Filter by location UUID"),
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve paginated inventory transaction log history for the current home space."""
    return await InventoryService.get_ledger_history(
        session=session,
        home_id=context.home_id,
        product_id=product_id,
        location_id=location_id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/state",
    response_model=Sequence[InventoryStateReadWithRelations],
    summary="Get current cached inventory stock levels",
)
async def get_current_state(
    product_id: Optional[uuid.UUID] = Query(default=None, description="Filter by product UUID"),
    location_id: Optional[uuid.UUID] = Query(default=None, description="Filter by location UUID"),
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve the real-time cached inventory levels, including nested product and location details."""
    return await InventoryService.get_current_state(
        session=session,
        home_id=context.home_id,
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
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve products that are below their minimum stock thresholds for the current home space."""
    return await InventoryService.get_low_stock_items(
        session=session,
        home_id=context.home_id,
    )


@router.get(
    "/expiration-summary",
    response_model=ExpirationSummary,
    summary="Get inventory expiration date summary status",
)
async def get_expiration_summary(
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve summary of inventory items categorized by their expiration status (Expired, Valid, Untracked)."""
    return await InventoryService.get_expiration_summary(
        session=session,
        home_id=context.home_id,
    )
