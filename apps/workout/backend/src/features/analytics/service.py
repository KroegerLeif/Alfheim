"""Read-only aggregation queries over session data.

No new tables: a materialized/cached summary table is premature for v1 (adds
staleness-invalidation complexity with no proven read-volume problem). Every
query here is strictly home_id-scoped, and the household leaderboard never
crosses households.
"""

import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.session.models import SessionExercise, SessionSet, SessionStatus, WorkoutSession


async def get_muscle_volume(
    session: AsyncSession,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[tuple[str, float]]:
    """Total volume (reps * weight) per primary muscle group for a user's completed sets."""
    statement = (
        select(
            SessionExercise.primary_muscle_snapshot,
            func.sum(func.coalesce(SessionSet.actual_reps, 0) * func.coalesce(SessionSet.actual_weight_kg, 0.0)),
        )
        .join(SessionExercise, col(SessionSet.session_exercise_id) == SessionExercise.id)
        .join(WorkoutSession, col(SessionExercise.session_id) == WorkoutSession.id)
        .where(
            WorkoutSession.home_id == home_id,
            WorkoutSession.user_id == user_id,
            col(SessionSet.actual_reps).is_not(None),
            col(SessionSet.actual_weight_kg).is_not(None),
        )
        .group_by(SessionExercise.primary_muscle_snapshot)
    )

    if from_date is not None:
        statement = statement.where(WorkoutSession.started_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date is not None:
        statement = statement.where(WorkoutSession.started_at <= datetime.combine(to_date, datetime.max.time()))

    result = await session.exec(statement)
    return [(muscle, float(volume or 0.0)) for muscle, volume in result.all()]


async def get_streaks(
    session: AsyncSession,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[int, int]:
    """Compute current and longest consecutive-day streaks of completed sessions.

    Computed in Python over a distinct-date list rather than a recursive SQL
    CTE: simpler, portable across SQLite/Postgres, and the dataset (one row
    per day a user worked out) is always small enough for this to be cheap.
    """
    statement = (
        select(func.date(WorkoutSession.started_at))
        .where(
            WorkoutSession.home_id == home_id,
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == SessionStatus.COMPLETED,
        )
        .distinct()
    )
    result = await session.exec(statement)
    raw_dates = result.all()

    workout_dates: set[date] = set()
    for raw in raw_dates:
        if isinstance(raw, date):
            workout_dates.add(raw)
        elif isinstance(raw, str):
            workout_dates.add(date.fromisoformat(raw))

    if not workout_dates:
        return 0, 0

    sorted_dates = sorted(workout_dates)

    longest = 1
    current_run = 1
    for previous_day, current_day in zip(sorted_dates, sorted_dates[1:], strict=False):
        if current_day - previous_day == timedelta(days=1):
            current_run += 1
        else:
            current_run = 1
        longest = max(longest, current_run)

    today = datetime.now().date()
    most_recent = sorted_dates[-1]
    if most_recent not in (today, today - timedelta(days=1)):
        current_streak = 0
    else:
        current_streak = 1
        cursor = most_recent
        for day in reversed(sorted_dates[:-1]):
            if cursor - day == timedelta(days=1):
                current_streak += 1
                cursor = day
            else:
                break

    return current_streak, longest


async def get_leaderboard(
    session: AsyncSession,
    home_id: uuid.UUID,
) -> list[tuple[uuid.UUID, float, int]]:
    """Household leaderboard: total volume and completed-session count per user.

    Strictly filtered to one home_id — never aggregates across households.
    """
    volume_statement = (
        select(
            WorkoutSession.user_id,
            func.sum(func.coalesce(SessionSet.actual_reps, 0) * func.coalesce(SessionSet.actual_weight_kg, 0.0)),
        )
        .join(SessionExercise, col(SessionExercise.session_id) == WorkoutSession.id)
        .join(SessionSet, col(SessionSet.session_exercise_id) == SessionExercise.id)
        .where(
            WorkoutSession.home_id == home_id,
            WorkoutSession.status == SessionStatus.COMPLETED,
            col(SessionSet.actual_reps).is_not(None),
            col(SessionSet.actual_weight_kg).is_not(None),
        )
        .group_by(col(WorkoutSession.user_id))
    )
    volume_result = await session.exec(volume_statement)
    volumes = {user_id: float(volume or 0.0) for user_id, volume in volume_result.all()}

    count_statement = (
        select(WorkoutSession.user_id, func.count(func.distinct(WorkoutSession.id)))
        .where(WorkoutSession.home_id == home_id, WorkoutSession.status == SessionStatus.COMPLETED)
        .group_by(col(WorkoutSession.user_id))
    )
    count_result = await session.exec(count_statement)
    counts = dict(count_result.all())

    all_user_ids = set(volumes) | set(counts)
    leaderboard = [(uid, volumes.get(uid, 0.0), counts.get(uid, 0)) for uid in all_user_ids]
    leaderboard.sort(key=lambda entry: entry[1], reverse=True)
    return leaderboard
