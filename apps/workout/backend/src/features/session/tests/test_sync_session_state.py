"""Sync must respect the session lifecycle and fill cloned plan sets instead of duplicating them."""

import uuid

import pytest
from httpx import AsyncClient
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.models import Exercise, ExerciseScope, MuscleGroup
from src.features.plans.models import TargetWeightType
from src.features.plans.schemas import PlanCreate, PlanDayCreate, PlanExerciseCreate, PlanSetCreate
from src.features.plans.services.plan_crud_service import PlanCrudService
from src.features.session.exceptions import SessionNotActiveError
from src.features.session.models import SessionExercise, SessionSet, SessionStatus, WorkoutSession
from src.features.session.schemas import SessionSetSyncItem
from src.features.session.services.session_lifecycle_service import (
    abandon_session,
    complete_session,
    get_session,
    start_session,
)
from src.features.session.services.session_sync_service import sync_sets


async def _freeform_session_with_exercise(
    db_session: AsyncSession, home_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[WorkoutSession, SessionExercise]:
    workout_session = await start_session(db_session, home_id, user_id)
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
    return workout_session, session_exercise


def _item(session_exercise: SessionExercise, key: str, set_order: int = 0) -> SessionSetSyncItem:
    return SessionSetSyncItem(
        client_idempotency_key=key,
        session_exercise_id=session_exercise.id,
        set_order=set_order,
        actual_reps=5,
        actual_weight_kg=100.0,
    )


async def _count_sets(db_session: AsyncSession, session_exercise: SessionExercise) -> int:
    result = await db_session.exec(select(SessionSet).where(SessionSet.session_exercise_id == session_exercise.id))
    return len(result.all())


@pytest.mark.parametrize("finalize", [complete_session, abandon_session])
async def test_sync_into_finalized_session_is_rejected(db_session: AsyncSession, finalize):
    home_id, user_id = uuid.uuid4(), uuid.uuid4()
    workout_session, session_exercise = await _freeform_session_with_exercise(db_session, home_id, user_id)
    await finalize(db_session, workout_session.id, home_id, user_id)

    with pytest.raises(SessionNotActiveError, match="can only be logged on an active session"):
        await sync_sets(db_session, workout_session.id, home_id, user_id, [_item(session_exercise, "late-key")])

    assert await _count_sets(db_session, session_exercise) == 0


async def test_replaying_a_stored_key_after_completion_is_still_acked(db_session: AsyncSession):
    home_id, user_id = uuid.uuid4(), uuid.uuid4()
    workout_session, session_exercise = await _freeform_session_with_exercise(db_session, home_id, user_id)
    item = _item(session_exercise, "stored-key")
    _, first_ids = await sync_sets(db_session, workout_session.id, home_id, user_id, [item])
    await complete_session(db_session, workout_session.id, home_id, user_id)

    acked, server_ids = await sync_sets(db_session, workout_session.id, home_id, user_id, [item])

    assert acked == ["stored-key"]
    assert server_ids == first_ids
    assert await _count_sets(db_session, session_exercise) == 1


async def test_unknown_exercise_is_still_skipped_in_finalized_session(db_session: AsyncSession):
    home_id, user_id = uuid.uuid4(), uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)
    await complete_session(db_session, workout_session.id, home_id, user_id)
    orphan = SessionSetSyncItem(client_idempotency_key="orphan", session_exercise_id=uuid.uuid4(), set_order=0)

    acked, server_ids = await sync_sets(db_session, workout_session.id, home_id, user_id, [orphan])

    assert acked == []
    assert server_ids == {}


async def test_sync_http_returns_409_session_not_active(client: AsyncClient, db_session: AsyncSession):
    create_res = await client.post("/api/v1/sessions", json={})
    session_id = uuid.UUID(create_res.json()["id"])
    session_exercise = SessionExercise(
        session_id=session_id,
        exercise_id=uuid.uuid4(),
        exercise_name_snapshot="Row",
        primary_muscle_snapshot="back",
        exercise_order=0,
    )
    db_session.add(session_exercise)
    await db_session.commit()
    await db_session.refresh(session_exercise)
    # Complete through the service: the hand-added exercise has no loaded `sets`, which the
    # response serializer of the REST complete route would try to lazy-load.
    workout_session = await db_session.get(WorkoutSession, session_id)
    assert workout_session is not None
    workout_session.status = SessionStatus.COMPLETED
    db_session.add(workout_session)
    await db_session.commit()

    payload = {
        "items": [
            {
                "client_idempotency_key": "late-http-key",
                "session_exercise_id": str(session_exercise.id),
                "set_order": 0,
                "actual_reps": 8,
                "actual_weight_kg": 40.0,
            }
        ]
    }
    res = await client.post(f"/api/v1/sessions/{session_id}/sets/sync", json=payload)

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "session_not_active"
    assert "completed" in res.json()["detail"]["message"]
    assert await _count_sets(db_session, session_exercise) == 0


async def test_sync_fills_cloned_plan_set_instead_of_adding_a_duplicate(db_session: AsyncSession):
    home_id, user_id = uuid.uuid4(), uuid.uuid4()
    exercise = Exercise(scope=ExerciseScope.HOUSEHOLD, home_id=home_id, name="Bench", primary_muscle=MuscleGroup.CHEST)
    db_session.add(exercise)
    await db_session.commit()
    await db_session.refresh(exercise)
    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(
            name="Day",
            days=[
                PlanDayCreate(
                    label="Push",
                    exercises=[
                        PlanExerciseCreate(
                            exercise_id=exercise.id,
                            sets=[
                                PlanSetCreate(
                                    target_reps=5, target_weight_type=TargetWeightType.ABSOLUTE, target_weight_kg=60
                                ),
                                PlanSetCreate(
                                    target_reps=5, target_weight_type=TargetWeightType.ABSOLUTE, target_weight_kg=60
                                ),
                            ],
                        )
                    ],
                )
            ],
        ),
        home_id,
        user_id,
    )
    workout_session = await start_session(db_session, home_id, user_id, plan.id, plan.days[0].id)
    session_exercise = workout_session.exercises[0]
    first_planned = session_exercise.sets[0]

    acked, server_ids = await sync_sets(
        db_session, workout_session.id, home_id, user_id, [_item(session_exercise, "k1", first_planned.set_order)]
    )

    assert acked == ["k1"]
    assert server_ids["k1"] == first_planned.id
    refetched = await get_session(db_session, workout_session.id, home_id, user_id)
    assert refetched is not None
    sets = refetched.exercises[0].sets
    assert len(sets) == 2
    done = [s for s in sets if s.completed_at is not None]
    assert [s.id for s in done] == [first_planned.id]
    assert done[0].actual_reps == 5
    assert done[0].target_weight_kg == 60
    open_sets = await db_session.exec(
        select(SessionSet).where(
            SessionSet.session_exercise_id == session_exercise.id, col(SessionSet.completed_at).is_(None)
        )
    )
    assert len(open_sets.all()) == 1
    assert refetched.status == SessionStatus.ACTIVE
