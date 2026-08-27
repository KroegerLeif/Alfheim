import uuid

from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.session.schemas import SessionSetSyncItem
from src.features.session.services.session_lifecycle_service import start_session
from src.features.session.services.session_sync_service import sync_sets


async def test_sync_sets_creates_new_rows(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)

    # Freeform session has no exercises yet — attach one manually to test sync in isolation.
    from src.features.session.models import SessionExercise

    session_exercise = SessionExercise(
        session_id=workout_session.id,
        exercise_id=uuid.uuid4(),
        exercise_name_snapshot="Squat",
        primary_muscle_snapshot="quads",
        exercise_order=0,
    )
    db_session.add(session_exercise)
    await db_session.commit()
    await db_session.refresh(session_exercise)

    item = SessionSetSyncItem(
        client_idempotency_key="key-1",
        session_exercise_id=session_exercise.id,
        set_order=0,
        actual_reps=5,
        actual_weight_kg=100.0,
    )

    acked, server_ids = await sync_sets(db_session, workout_session.id, home_id, user_id, [item])

    assert acked == ["key-1"]
    assert "key-1" in server_ids


async def test_sync_sets_duplicate_batch_is_idempotent(db_session: AsyncSession):
    """Re-POSTing the same batch (e.g. after a flaky network retry) must not create duplicate rows."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)

    from src.features.session.models import SessionExercise

    session_exercise = SessionExercise(
        session_id=workout_session.id,
        exercise_id=uuid.uuid4(),
        exercise_name_snapshot="Deadlift",
        primary_muscle_snapshot="hamstrings",
        exercise_order=0,
    )
    db_session.add(session_exercise)
    await db_session.commit()
    await db_session.refresh(session_exercise)

    item = SessionSetSyncItem(
        client_idempotency_key="retry-key",
        session_exercise_id=session_exercise.id,
        set_order=0,
        actual_reps=3,
        actual_weight_kg=150.0,
    )

    acked_1, server_ids_1 = await sync_sets(db_session, workout_session.id, home_id, user_id, [item])
    acked_2, server_ids_2 = await sync_sets(db_session, workout_session.id, home_id, user_id, [item])

    assert acked_1 == acked_2 == ["retry-key"]
    assert server_ids_1["retry-key"] == server_ids_2["retry-key"]

    from sqlmodel import select
    from src.features.session.models import SessionSet

    count_result = await db_session.exec(
        select(SessionSet).where(SessionSet.session_exercise_id == session_exercise.id)
    )
    assert len(count_result.all()) == 1


async def test_sync_sets_unknown_session_exercise_skipped(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)

    item = SessionSetSyncItem(
        client_idempotency_key="orphan-key",
        session_exercise_id=uuid.uuid4(),
        set_order=0,
    )

    acked, server_ids = await sync_sets(db_session, workout_session.id, home_id, user_id, [item])

    assert acked == []
    assert server_ids == {}
