"""Façade service for the plans feature.

router.py and mcp_tools.py both import from here, never directly from
services/*.py, so the CRUD orchestration and the weight-engine resolution
each stay in exactly one place.
"""

import uuid

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.models import UserExercisePreference
from src.features.plans.models import PlanDay
from src.features.plans.services.plan_crud_service import PlanCrudService
from src.features.plans.services.weight_engine_service import resolve_target_weight

# Re-export CRUD operations so router.py/mcp_tools.py have a single import surface.
create_plan = PlanCrudService.create_plan
list_plans = PlanCrudService.list_plans
get_plan = PlanCrudService.get_plan
update_plan = PlanCrudService.update_plan
delete_plan = PlanCrudService.delete_plan
add_day = PlanCrudService.add_day
delete_day = PlanCrudService.delete_day
add_exercise = PlanCrudService.add_exercise
delete_exercise = PlanCrudService.delete_exercise
add_set = PlanCrudService.add_set
update_set = PlanCrudService.update_set
delete_set = PlanCrudService.delete_set


async def resolve_day(
    session: AsyncSession,
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[PlanDay, dict[uuid.UUID, float | None]] | None:
    """Fetch a plan day with every set's weight-engine target resolved for the caller.

    Returns (PlanDay, resolved) where resolved maps plan_set_id -> resolved kg
    (or None if unresolvable, e.g. no baseline preference yet). Kept separate
    from the ORM object rather than attached to it, since PlanSet has no such
    column — router.py zips the two together to build ResolvedDayRead.
    """
    plan = await PlanCrudService.get_plan(session, plan_id, home_id, user_id)
    if not plan:
        return None
    # Query the day directly rather than trusting plan.days: with
    # expire_on_commit=False, a Plan already loaded earlier in this session
    # can carry a stale relationship collection (see plan_crud_service.py's
    # class docstring).
    day_statement = select(PlanDay).where(PlanDay.id == day_id, PlanDay.plan_id == plan.id)
    day_result = await session.exec(day_statement)
    day = day_result.first()
    if not day:
        return None

    exercise_ids = {pe.exercise_id for pe in day.exercises}
    preferences: dict[uuid.UUID, UserExercisePreference] = {}
    if exercise_ids:
        statement = select(UserExercisePreference).where(
            UserExercisePreference.user_id == user_id,
            col(UserExercisePreference.exercise_id).in_(exercise_ids),
        )
        result = await session.exec(statement)
        preferences = {p.exercise_id: p for p in result.all()}

    resolved: dict[uuid.UUID, float | None] = {}
    for plan_exercise in day.exercises:
        preference = preferences.get(plan_exercise.exercise_id)
        for plan_set in plan_exercise.sets:
            resolved[plan_set.id] = resolve_target_weight(plan_set, preference)

    return day, resolved
