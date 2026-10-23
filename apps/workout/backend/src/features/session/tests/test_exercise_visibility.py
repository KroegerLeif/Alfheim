import uuid

from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.models import Exercise, ExerciseScope, MuscleGroup
from src.features.plans.models import PlanExercise
from src.features.plans.schemas import PlanCreate, PlanDayCreate
from src.features.plans.services.plan_crud_service import PlanCrudService
from src.features.session.services.session_lifecycle_service import start_session


async def test_session_start_skips_exercises_of_other_households(db_session: AsyncSession):
    """A plan row referencing another household's exercise must not leak that exercise into the session."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    foreign = Exercise(
        scope=ExerciseScope.HOUSEHOLD, home_id=uuid.uuid4(), name="Foreign Lift", primary_muscle=MuscleGroup.CHEST
    )
    db_session.add(foreign)
    await db_session.commit()

    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(name="Day", days=[PlanDayCreate(label="Push", exercises=[])]),
        home_id,
        user_id,
    )
    day = plan.days[0]
    # Bypass the service-level visibility check to simulate legacy or poisoned data.
    db_session.add(PlanExercise(plan_day_id=day.id, exercise_id=foreign.id, exercise_order=0))
    await db_session.commit()

    workout_session = await start_session(db_session, home_id, user_id, plan.id, day.id)

    assert workout_session.exercises == []
