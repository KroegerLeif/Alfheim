import uuid
from datetime import UTC, datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.analytics.service import get_leaderboard, get_muscle_volume, get_streaks
from src.features.session.models import SessionExercise, SessionSet, SessionStatus, WorkoutSession


async def _create_completed_session_with_set(
    db_session: AsyncSession,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
    muscle: str,
    reps: int,
    weight: float,
    started_at: datetime | None = None,
) -> WorkoutSession:
    workout_session = WorkoutSession(
        home_id=home_id,
        user_id=user_id,
        status=SessionStatus.COMPLETED,
        started_at=started_at or datetime.now(UTC),
        completed_at=started_at or datetime.now(UTC),
    )
    db_session.add(workout_session)
    await db_session.commit()
    await db_session.refresh(workout_session)

    session_exercise = SessionExercise(
        session_id=workout_session.id,
        exercise_id=uuid.uuid4(),
        exercise_name_snapshot="Test Exercise",
        primary_muscle_snapshot=muscle,
        exercise_order=0,
    )
    db_session.add(session_exercise)
    await db_session.commit()
    await db_session.refresh(session_exercise)

    session_set = SessionSet(
        session_exercise_id=session_exercise.id,
        set_order=0,
        actual_reps=reps,
        actual_weight_kg=weight,
    )
    db_session.add(session_set)
    await db_session.commit()

    return workout_session


async def test_muscle_volume_aggregates_by_muscle_group(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    await _create_completed_session_with_set(db_session, home_id, user_id, "chest", reps=10, weight=50.0)
    await _create_completed_session_with_set(db_session, home_id, user_id, "chest", reps=5, weight=20.0)
    await _create_completed_session_with_set(db_session, home_id, user_id, "back", reps=8, weight=40.0)

    entries = await get_muscle_volume(db_session, home_id, user_id)
    volumes = dict(entries)

    assert volumes["chest"] == 10 * 50.0 + 5 * 20.0
    assert volumes["back"] == 8 * 40.0


async def test_muscle_volume_excludes_other_household(db_session: AsyncSession):
    home_a = uuid.uuid4()
    home_b = uuid.uuid4()
    user_id = uuid.uuid4()
    await _create_completed_session_with_set(db_session, home_a, user_id, "chest", reps=10, weight=50.0)
    await _create_completed_session_with_set(db_session, home_b, user_id, "chest", reps=100, weight=500.0)

    entries = await get_muscle_volume(db_session, home_a, user_id)
    volumes = dict(entries)

    assert volumes["chest"] == 500.0


async def test_streaks_no_sessions_returns_zero(db_session: AsyncSession):
    current, longest = await get_streaks(db_session, uuid.uuid4(), uuid.uuid4())
    assert current == 0
    assert longest == 0


async def test_streaks_consecutive_days(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    today = datetime.now(UTC)

    for days_ago in range(3):
        await _create_completed_session_with_set(
            db_session, home_id, user_id, "core", reps=1, weight=1.0, started_at=today - timedelta(days=days_ago)
        )

    current, longest = await get_streaks(db_session, home_id, user_id)
    assert current == 3
    assert longest == 3


async def test_streaks_broken_by_gap(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    today = datetime.now(UTC)

    await _create_completed_session_with_set(db_session, home_id, user_id, "core", 1, 1.0, today)
    await _create_completed_session_with_set(db_session, home_id, user_id, "core", 1, 1.0, today - timedelta(days=5))
    await _create_completed_session_with_set(db_session, home_id, user_id, "core", 1, 1.0, today - timedelta(days=6))

    current, longest = await get_streaks(db_session, home_id, user_id)
    assert current == 1
    assert longest == 2


async def test_leaderboard_ranks_by_volume_within_household(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    await _create_completed_session_with_set(db_session, home_id, user_a, "chest", 10, 100.0)
    await _create_completed_session_with_set(db_session, home_id, user_b, "chest", 10, 10.0)

    leaderboard = await get_leaderboard(db_session, home_id)

    assert leaderboard[0][0] == user_a
    assert leaderboard[0][1] == 1000.0
    assert leaderboard[1][0] == user_b


async def test_leaderboard_never_crosses_households(db_session: AsyncSession):
    home_a = uuid.uuid4()
    home_b = uuid.uuid4()
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    await _create_completed_session_with_set(db_session, home_a, user_a, "chest", 10, 100.0)
    await _create_completed_session_with_set(db_session, home_b, user_b, "chest", 10, 999.0)

    leaderboard = await get_leaderboard(db_session, home_a)

    assert len(leaderboard) == 1
    assert leaderboard[0][0] == user_a
