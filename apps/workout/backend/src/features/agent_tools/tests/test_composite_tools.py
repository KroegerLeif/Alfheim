import uuid
from unittest.mock import patch

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.agent_tools.mcp_tools import (
    finish_workout_session,
    get_todays_plan,
    log_completed_set,
    start_workout_session,
)
from src.features.exercises.models import Exercise, ExerciseScope, MuscleGroup, UserExercisePreference
from src.features.plans.models import TargetWeightType
from src.features.plans.schemas import PlanCreate, PlanDayCreate, PlanExerciseCreate, PlanSetCreate
from src.features.plans.services.plan_crud_service import PlanCrudService


@pytest.fixture(autouse=True)
def override_mcp_session(db_session: AsyncSession):
    """Patch async_session_factory in the composite mcp_tools module to use the test db_session."""

    class TestSessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("src.features.agent_tools.mcp_tools.async_session_factory", side_effect=TestSessionContext):
        yield


async def test_composite_start_session_log_set_finish_flow(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    exercise = Exercise(
        scope=ExerciseScope.HOUSEHOLD, home_id=home_id, name="Overhead Press", primary_muscle=MuscleGroup.SHOULDERS
    )
    db_session.add(exercise)
    await db_session.commit()
    await db_session.refresh(exercise)

    db_session.add(
        UserExercisePreference(home_id=home_id, user_id=user_id, exercise_id=exercise.id, default_target_weight_kg=40.0)
    )
    await db_session.commit()

    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(
            name="OHP Day",
            days=[
                PlanDayCreate(
                    label="Push",
                    exercises=[
                        PlanExerciseCreate(
                            exercise_id=exercise.id,
                            sets=[PlanSetCreate(target_reps=8, target_weight_type=TargetWeightType.DEFAULT)],
                        )
                    ],
                )
            ],
        ),
        home_id,
        user_id,
    )
    day_id = plan.days[0].id

    plan_summary = await get_todays_plan(str(home_id), str(user_id), str(plan.id), str(day_id))
    assert "40.0 kg" in plan_summary

    start_result = await start_workout_session(str(home_id), str(user_id), str(plan.id), str(day_id))
    assert "Success: Started session" in start_result
    session_id = start_result.split("Started session ")[1].split(" ")[0]

    from sqlmodel import select
    from src.features.session.models import SessionExercise

    se_result = await db_session.exec(
        select(SessionExercise).where(SessionExercise.session_id == uuid.UUID(session_id))
    )
    session_exercise = se_result.first()
    assert session_exercise is not None

    log_result = await log_completed_set(
        str(home_id),
        str(user_id),
        session_id,
        str(session_exercise.id),
        0,
        "composite-key-1",
        actual_reps=8,
        actual_weight_kg=40.0,
    )
    assert "Success: Logged set" in log_result

    finish_result = await finish_workout_session(str(home_id), str(user_id), session_id)
    assert "Success: Completed session" in finish_result


async def test_composite_get_todays_plan_not_found(db_session: AsyncSession):
    result = await get_todays_plan(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()))
    assert "not found" in result.lower()


async def test_composite_start_session_cross_household_rejected(db_session: AsyncSession):
    home_a = uuid.uuid4()
    home_b = uuid.uuid4()
    user_id = uuid.uuid4()

    plan = await PlanCrudService.create_plan(db_session, PlanCreate(name="Solo Plan"), home_a, user_id)
    day = await PlanCrudService.add_day(db_session, plan.id, home_a, user_id, PlanDayCreate(label="Day 1"))
    assert day is not None

    result = await start_workout_session(str(home_b), str(user_id), str(plan.id), str(day.id))
    assert "Error" in result
