from datetime import date

from backend_shared.household import HouseholdContext, require_household
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.features.analytics import service
from src.features.analytics.schemas import (
    LeaderboardEntry,
    LeaderboardResponse,
    MuscleVolumeEntry,
    MuscleVolumeResponse,
    StreakResponse,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/muscle-volume", response_model=MuscleVolumeResponse)
async def get_muscle_volume(
    from_date: date | None = None,
    to_date: date | None = None,
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Total training volume (reps x weight) per muscle group for the caller."""
    entries = await service.get_muscle_volume(session, context.household_id, context.user_id, from_date, to_date)
    return MuscleVolumeResponse(
        from_date=from_date,
        to_date=to_date,
        entries=[MuscleVolumeEntry(primary_muscle=m, total_volume_kg=v) for m, v in entries],
    )


@router.get("/streaks", response_model=StreakResponse)
async def get_streaks(
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Current and longest consecutive-day completed-session streaks for the caller."""
    current, longest = await service.get_streaks(session, context.household_id, context.user_id)
    return StreakResponse(current_streak_days=current, longest_streak_days=longest)


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
):
    """Household leaderboard ranked by total training volume. Never crosses households."""
    entries = await service.get_leaderboard(session, context.household_id)
    return LeaderboardResponse(
        entries=[
            LeaderboardEntry(user_id=str(uid), total_volume_kg=vol, completed_session_count=count)
            for uid, vol, count in entries
        ]
    )
