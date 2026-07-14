import uuid
from typing import Sequence
from fastapi import APIRouter, Depends, status, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import get_current_user_and_home, UserHomeContext
from src.features.history.service import ShoppingHistoryService
from src.features.history.schemas import ShoppingHistoryRead

router = APIRouter(prefix="/api/v1/shopping-history", tags=["shopping-history"])


@router.get(
    "",
    response_model=Sequence[ShoppingHistoryRead],
    summary="Get purchase history for quick-selection grids",
)
async def get_history(
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve frequently purchased items scoped by the home space, ordered by frequency."""
    return await ShoppingHistoryService.get_history(
        session=session,
        home_id=context.home_id,
    )


@router.delete(
    "/{history_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a history selection entry",
)
async def delete_history_item(
    history_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete an item from the quick-selection search history logs."""
    success = await ShoppingHistoryService.delete_history_item(
        session=session,
        history_id=history_id,
        home_id=context.home_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History entry not found or unauthorized.",
        )
