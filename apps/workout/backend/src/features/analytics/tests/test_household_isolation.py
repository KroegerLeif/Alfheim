import uuid

from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.session.models import SessionExercise, SessionSet, SessionStatus, WorkoutSession


async def test_leaderboard_household_isolation(client: AsyncClient, db_session: AsyncSession):
    home_a = uuid.uuid4()
    home_b = uuid.uuid4()
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()

    for home_id, user_id, weight in [(home_a, user_a, 100.0), (home_b, user_b, 999.0)]:
        workout_session = WorkoutSession(home_id=home_id, user_id=user_id, status=SessionStatus.COMPLETED)
        db_session.add(workout_session)
        await db_session.commit()
        await db_session.refresh(workout_session)

        session_exercise = SessionExercise(
            session_id=workout_session.id,
            exercise_id=uuid.uuid4(),
            exercise_name_snapshot="Test",
            primary_muscle_snapshot="chest",
            exercise_order=0,
        )
        db_session.add(session_exercise)
        await db_session.commit()
        await db_session.refresh(session_exercise)

        db_session.add(
            SessionSet(
                session_exercise_id=session_exercise.id,
                set_order=0,
                actual_reps=1,
                actual_weight_kg=weight,
            )
        )
        await db_session.commit()

    res = await client.get("/api/v1/analytics/leaderboard", headers={"X-Household-ID": str(home_a)})
    assert res.status_code == 200
    entries = res.json()["entries"]

    assert len(entries) == 1
    assert entries[0]["user_id"] == str(user_a)
    assert entries[0]["total_volume_kg"] == 100.0
