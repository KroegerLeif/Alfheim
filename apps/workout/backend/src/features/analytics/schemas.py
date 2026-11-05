"""Response schemas of the analytics feature."""

from datetime import date

from sqlmodel import SQLModel


class MuscleVolumeEntry(SQLModel):
    """Total volume lifted for one primary muscle group."""

    primary_muscle: str
    total_volume_kg: float


class MuscleVolumeResponse(SQLModel):
    """Per-muscle volume over an optional date range."""

    from_date: date | None
    to_date: date | None
    entries: list[MuscleVolumeEntry]


class StreakResponse(SQLModel):
    """Current and longest consecutive-day workout streaks."""

    current_streak_days: int
    longest_streak_days: int


class LeaderboardEntry(SQLModel):
    """One household member's volume and completed-session count."""

    user_id: str
    total_volume_kg: float
    completed_session_count: int


class LeaderboardResponse(SQLModel):
    """Household leaderboard entries."""

    entries: list[LeaderboardEntry]
