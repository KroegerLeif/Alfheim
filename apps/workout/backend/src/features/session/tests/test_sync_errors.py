import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.session.exceptions import SessionValidationError
from src.features.session.models import SessionExercise, SessionSet, SessionStatus, WorkoutSession
from src.features.session.schemas import SessionSetSyncItem
from src.features.session.services.session_sync_service import sync_sets


async def test_session_router_not_found_errors(client: AsyncClient):
    """Verify HTTP 404 responses for non-existent session endpoints."""
    random_id = uuid.uuid4()

    res = await client.get(f"/api/v1/sessions/{random_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Session not found."

    res = await client.post(f"/api/v1/sessions/{random_id}/complete")
    assert res.status_code == 404
    assert res.json()["detail"] == "Session not found."

    res = await client.post(f"/api/v1/sessions/{random_id}/abandon")
    assert res.status_code == 404
    assert res.json()["detail"] == "Session not found."


async def test_sync_sets_invalid_session_raises(db_session: AsyncSession):
    """Verify sync_sets raises SessionValidationError if workout session is not found."""
    with pytest.raises(SessionValidationError, match="Session not found"):
        await sync_sets(
            db_session,
            session_id=uuid.uuid4(),
            home_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            items=[],
        )


async def test_sync_sets_concurrent_race_integrity_error(db_session: AsyncSession):
    """Verify sync_sets recovers when IntegrityError occurs due to concurrent insert."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    workout = WorkoutSession(
        home_id=home_id,
        user_id=user_id,
        name="Test Sync Session",
        status=SessionStatus.ACTIVE,
    )
    db_session.add(workout)
    await db_session.commit()
    from src.features.exercises.models import Exercise, ExerciseScope, MuscleGroup

    exercise = Exercise(
        name="Squat",
        scope=ExerciseScope.SYSTEM,
        primary_muscle=MuscleGroup.QUADS,
    )
    db_session.add(exercise)
    await db_session.commit()
    await db_session.refresh(exercise)

    ex = SessionExercise(
        session_id=workout.id,
        exercise_id=exercise.id,
        exercise_name_snapshot="Squat",
        primary_muscle_snapshot="quads",
        exercise_order=0,
    )
    db_session.add(ex)
    await db_session.commit()
    await db_session.refresh(ex)

    idem_key = "idempotency-key-race-test"
    item = SessionSetSyncItem(
        session_exercise_id=ex.id,
        set_order=0,
        actual_reps=5,
        actual_weight_kg=100.0,
        is_warmup=False,
        client_idempotency_key=idem_key,
    )

    fake_set = SessionSet(
        id=uuid.uuid4(),
        session_exercise_id=ex.id,
        set_order=0,
        actual_reps=5,
        actual_weight_kg=100.0,
        is_warmup=False,
        client_idempotency_key=idem_key,
    )

    from unittest.mock import MagicMock

    retry_res = MagicMock()
    retry_res.first.return_value = fake_set

    orig_exec = db_session.exec
    first_commit = True

    async def mock_commit():
        nonlocal first_commit
        if first_commit:
            first_commit = False
            raise IntegrityError("stmt", "params", Exception("unique violation"))

    async def mock_exec(statement):
        if not first_commit:
            return retry_res
        return await orig_exec(statement)

    with (
        patch.object(db_session, "commit", side_effect=mock_commit),
        patch.object(db_session, "rollback", AsyncMock()),
        patch.object(db_session, "exec", side_effect=mock_exec),
    ):
        acked, server_ids = await sync_sets(
            db_session,
            workout.id,
            home_id,
            user_id,
            [item],
        )

    assert idem_key in acked
    assert server_ids[idem_key] == fake_set.id
