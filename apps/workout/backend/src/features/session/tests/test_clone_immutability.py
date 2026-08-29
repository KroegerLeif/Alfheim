import uuid

from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.models import Exercise, ExerciseScope, MuscleGroup, UserExercisePreference
from src.features.plans.models import TargetWeightType
from src.features.plans.schemas import PlanCreate, PlanDayCreate, PlanExerciseCreate, PlanSetCreate
from src.features.plans.services.plan_crud_service import PlanCrudService
from src.features.session.services.session_lifecycle_service import start_session


async def _seed_exercise(db_session: AsyncSession, home_id: uuid.UUID) -> Exercise:
    exercise = Exercise(
        scope=ExerciseScope.HOUSEHOLD,
        home_id=home_id,
        name="Bench Press",
        primary_muscle=MuscleGroup.CHEST,
    )
    db_session.add(exercise)
    await db_session.commit()
    await db_session.refresh(exercise)
    return exercise


async def test_session_clone_survives_plan_deletion(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    exercise = await _seed_exercise(db_session, home_id)

    db_session.add(
        UserExercisePreference(home_id=home_id, user_id=user_id, exercise_id=exercise.id, default_target_weight_kg=80.0)
    )
    await db_session.commit()

    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(
            name="Bench Day",
            days=[
                PlanDayCreate(
                    label="Push",
                    exercises=[
                        PlanExerciseCreate(
                            exercise_id=exercise.id,
                            sets=[PlanSetCreate(target_reps=5, target_weight_type=TargetWeightType.DEFAULT)],
                        )
                    ],
                )
            ],
        ),
        home_id,
        user_id,
    )
    day_id = plan.days[0].id

    workout_session = await start_session(db_session, home_id, user_id, plan.id, day_id)

    assert len(workout_session.exercises) == 1
    assert workout_session.exercises[0].exercise_name_snapshot == "Bench Press"
    assert workout_session.exercises[0].sets[0].target_weight_kg == 80.0

    # Delete the source plan entirely.
    await PlanCrudService.delete_plan(db_session, plan.id, home_id, user_id)

    # Re-fetch the session fresh from the DB — its cloned data must be untouched.
    from src.features.session.services.session_lifecycle_service import get_session

    refetched = await get_session(db_session, workout_session.id, home_id, user_id)
    assert refetched is not None
    assert len(refetched.exercises) == 1
    assert refetched.exercises[0].exercise_name_snapshot == "Bench Press"
    assert refetched.exercises[0].sets[0].target_weight_kg == 80.0


async def test_session_clone_unaffected_by_later_preference_change(db_session: AsyncSession):
    """If the user's baseline weight changes after a session started, the already-cloned
    resolved weight must not change — only future sessions see the new baseline."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    exercise = await _seed_exercise(db_session, home_id)

    preference = UserExercisePreference(
        home_id=home_id, user_id=user_id, exercise_id=exercise.id, default_target_weight_kg=60.0
    )
    db_session.add(preference)
    await db_session.commit()

    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(
            name="Plan",
            days=[
                PlanDayCreate(
                    label="Day 1",
                    exercises=[
                        PlanExerciseCreate(
                            exercise_id=exercise.id,
                            sets=[PlanSetCreate(target_weight_type=TargetWeightType.DEFAULT)],
                        )
                    ],
                )
            ],
        ),
        home_id,
        user_id,
    )
    day_id = plan.days[0].id

    workout_session = await start_session(db_session, home_id, user_id, plan.id, day_id)
    assert workout_session.exercises[0].sets[0].target_weight_kg == 60.0

    # User updates their baseline weight after the session was started.
    preference.default_target_weight_kg = 100.0
    db_session.add(preference)
    await db_session.commit()

    from src.features.session.services.session_lifecycle_service import get_session

    refetched = await get_session(db_session, workout_session.id, home_id, user_id)
    assert refetched is not None
    assert refetched.exercises[0].sets[0].target_weight_kg == 60.0


async def test_freeform_session_without_plan(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    workout_session = await start_session(db_session, home_id, user_id)

    assert workout_session.plan_id is None
    assert workout_session.exercises == []
