import uuid

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.models import HouseholdStreak


class StreakService:
    """Service class encapsulating household streak tracking."""

    @staticmethod
    async def ensure_household_streak(session: AsyncSession, home_id: uuid.UUID) -> HouseholdStreak:
        """Get or create the HouseholdStreak record for a household."""
        stmt = select(HouseholdStreak).where(HouseholdStreak.home_id == home_id)
        res = await session.exec(stmt)
        streak = res.first()
        if not streak:
            streak = HouseholdStreak(
                home_id=home_id,
                current_streak=0,
                longest_streak=0,
                last_completed_date=None,
            )
            session.add(streak)
            try:
                await session.commit()
                await session.refresh(streak)
            except IntegrityError:
                await session.rollback()
                # If race occurred, select it again
                res = await session.exec(stmt)
                streak = res.first()
        assert streak is not None
        return streak
