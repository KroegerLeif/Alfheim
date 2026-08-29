from datetime import date

from sqlmodel import SQLModel


class MuscleVolumeEntry(SQLModel):
    primary_muscle: str
    total_volume_kg: float


class MuscleVolumeResponse(SQLModel):
    from_date: date | None
    to_date: date | None
    entries: list[MuscleVolumeEntry]


class StreakResponse(SQLModel):
    current_streak_days: int
    longest_streak_days: int


class LeaderboardEntry(SQLModel):
    user_id: str
    total_volume_kg: float
    completed_session_count: int


class LeaderboardResponse(SQLModel):
    entries: list[LeaderboardEntry]
