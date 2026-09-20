import uuid
from collections.abc import Sequence

from backend_shared.household import HouseholdContext, require_household
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.features.history.schemas import ShoppingHistoryRead
from src.features.history.service import ShoppingHistoryService

router = APIRouter(prefix="/api/v1/shopping-history", tags=["shopping-history"])


@router.get(
    "",
    response_model=Sequence[ShoppingHistoryRead],
    summary="Get purchase history for quick-selection grids",
)
async def get_history(
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Retrieve frequently purchased items scoped by the home space, ordered by frequency."""
    return await ShoppingHistoryService.get_history(
        session=session,
        home_id=context.household_id,
    )


@router.delete(
    "/{history_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a history selection entry",
)
async def delete_history_item(
    history_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Delete an item from the quick-selection search history logs."""
    success = await ShoppingHistoryService.delete_history_item(
        session=session,
        history_id=history_id,
        home_id=context.household_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History entry not found or unauthorized.",
        )
