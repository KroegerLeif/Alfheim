import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import and_, col, func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.plans.exceptions import PlanValidationError
from src.features.plans.models import Plan, PlanDay, PlanExercise, PlanSet
from src.features.plans.schemas import (
    PlanCreate,
    PlanDayCreate,
    PlanExerciseCreate,
    PlanSetCreate,
    PlanSetUpdate,
    PlanUpdate,
)
from src.features.plans.services.weight_engine_service import validate_weight_fields


def _visibility_filter(home_id: uuid.UUID, user_id: uuid.UUID):
    """A plan is visible if the caller owns it, or it's shared within the caller's household."""
    return and_(
        Plan.home_id == home_id,
        or_(Plan.owner_user_id == user_id, col(Plan.is_shared).is_(True)),
    )


def _build_set(payload: PlanSetCreate, set_order: int) -> PlanSet:
    validate_weight_fields(payload.target_weight_type, payload.target_weight_kg, payload.offset_kg)
    return PlanSet(
        set_order=set_order,
        target_reps=payload.target_reps,
        target_weight_type=payload.target_weight_type,
        target_weight_kg=payload.target_weight_kg,
        offset_kg=payload.offset_kg,
        is_warmup=payload.is_warmup,
    )


def _build_exercise(payload: PlanExerciseCreate, exercise_order: int) -> PlanExercise:
    plan_exercise = PlanExercise(exercise_id=payload.exercise_id, exercise_order=exercise_order)
    plan_exercise.sets = [_build_set(s, i) for i, s in enumerate(payload.sets)]
    return plan_exercise


def _build_day(payload: PlanDayCreate, day_order: int) -> PlanDay:
    day = PlanDay(label=payload.label, day_order=day_order)
    day.exercises = [_build_exercise(e, i) for i, e in enumerate(payload.exercises)]
    return day


class PlanCrudService:
    """Service class encapsulating nested Plan/PlanDay/PlanExercise/PlanSet CRUD.

    Nested lookups (day/exercise/set) always query the DB directly by
    parent-scoped WHERE clauses rather than traversing an already-loaded
    Plan's relationship collections: with expire_on_commit=False, a
    long-lived session's identity-mapped Plan object can hold a stale
    `plan.days` list after a sibling write earlier in the same session (e.g.
    add_day() committing a new row doesn't retroactively update an
    already-loaded `plan.days` Python list). Direct queries are correct
    regardless of what's already loaded in the session.
    """

    @staticmethod
    async def create_plan(
        session: AsyncSession,
        payload: PlanCreate,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Plan:
        plan = Plan(
            home_id=home_id,
            owner_user_id=user_id,
            name=payload.name,
            description=payload.description,
            is_shared=payload.is_shared,
        )
        plan.days = [_build_day(d, i) for i, d in enumerate(payload.days)]
        session.add(plan)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise PlanValidationError(f"Failed to create plan: {e}") from e
        await session.refresh(plan)
        return plan

    @staticmethod
    async def list_plans(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Plan]:
        statement = (
            select(Plan).where(_visibility_filter(home_id, user_id)).order_by(Plan.name).offset(offset).limit(limit)
        )
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def get_plan(
        session: AsyncSession,
        plan_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Plan | None:
        statement = select(Plan).where(Plan.id == plan_id, _visibility_filter(home_id, user_id))
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def _get_owned_plan(
        session: AsyncSession,
        plan_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Plan | None:
        """Only the owner may write to a plan, even if it's shared with the household."""
        statement = select(Plan).where(
            Plan.id == plan_id,
            Plan.home_id == home_id,
            Plan.owner_user_id == user_id,
        )
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def _get_day(session: AsyncSession, plan_id: uuid.UUID, day_id: uuid.UUID) -> PlanDay | None:
        statement = select(PlanDay).where(PlanDay.id == day_id, PlanDay.plan_id == plan_id)
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def _get_exercise(
        session: AsyncSession, day_id: uuid.UUID, plan_exercise_id: uuid.UUID
    ) -> PlanExercise | None:
        statement = select(PlanExercise).where(PlanExercise.id == plan_exercise_id, PlanExercise.plan_day_id == day_id)
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def _get_set(session: AsyncSession, plan_exercise_id: uuid.UUID, set_id: uuid.UUID) -> PlanSet | None:
        statement = select(PlanSet).where(PlanSet.id == set_id, PlanSet.plan_exercise_id == plan_exercise_id)
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def update_plan(
        session: AsyncSession,
        plan_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: PlanUpdate,
    ) -> Plan | None:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)

        session.add(plan)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise PlanValidationError(f"Failed to update plan: {e}") from e
        await session.refresh(plan)
        return plan

    @staticmethod
    async def delete_plan(
        session: AsyncSession,
        plan_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return False
        await session.delete(plan)
        await session.commit()
        return True

    @staticmethod
    async def add_day(
        session: AsyncSession,
        plan_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: PlanDayCreate,
    ) -> PlanDay | None:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return None
        count_result = await session.exec(select(func.count()).select_from(PlanDay).where(PlanDay.plan_id == plan.id))
        day_order = count_result.one()
        day = _build_day(payload, day_order)
        day.plan_id = plan.id
        session.add(day)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise PlanValidationError(f"Failed to add plan day: {e}") from e
        await session.refresh(day)
        return day

    @staticmethod
    async def delete_day(
        session: AsyncSession,
        plan_id: uuid.UUID,
        day_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return False
        day = await PlanCrudService._get_day(session, plan.id, day_id)
        if not day:
            return False
        await session.delete(day)
        await session.commit()
        return True

    @staticmethod
    async def add_exercise(
        session: AsyncSession,
        plan_id: uuid.UUID,
        day_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: PlanExerciseCreate,
    ) -> PlanExercise | None:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return None
        day = await PlanCrudService._get_day(session, plan.id, day_id)
        if not day:
            return None
        count_result = await session.exec(
            select(func.count()).select_from(PlanExercise).where(PlanExercise.plan_day_id == day.id)
        )
        exercise_order = count_result.one()
        plan_exercise = _build_exercise(payload, exercise_order)
        plan_exercise.plan_day_id = day.id
        session.add(plan_exercise)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise PlanValidationError(f"Failed to add plan exercise: {e}") from e
        await session.refresh(plan_exercise)
        return plan_exercise

    @staticmethod
    async def delete_exercise(
        session: AsyncSession,
        plan_id: uuid.UUID,
        day_id: uuid.UUID,
        plan_exercise_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return False
        day = await PlanCrudService._get_day(session, plan.id, day_id)
        if not day:
            return False
        exercise = await PlanCrudService._get_exercise(session, day.id, plan_exercise_id)
        if not exercise:
            return False
        await session.delete(exercise)
        await session.commit()
        return True

    @staticmethod
    async def add_set(
        session: AsyncSession,
        plan_id: uuid.UUID,
        day_id: uuid.UUID,
        plan_exercise_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: PlanSetCreate,
    ) -> PlanSet | None:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return None
        day = await PlanCrudService._get_day(session, plan.id, day_id)
        if not day:
            return None
        exercise = await PlanCrudService._get_exercise(session, day.id, plan_exercise_id)
        if not exercise:
            return None
        count_result = await session.exec(
            select(func.count()).select_from(PlanSet).where(PlanSet.plan_exercise_id == exercise.id)
        )
        set_order = count_result.one()
        plan_set = _build_set(payload, set_order)
        plan_set.plan_exercise_id = exercise.id
        session.add(plan_set)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise PlanValidationError(f"Failed to add plan set: {e}") from e
        await session.refresh(plan_set)
        return plan_set

    @staticmethod
    async def update_set(
        session: AsyncSession,
        plan_id: uuid.UUID,
        day_id: uuid.UUID,
        plan_exercise_id: uuid.UUID,
        set_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: PlanSetUpdate,
    ) -> PlanSet | None:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return None
        day = await PlanCrudService._get_day(session, plan.id, day_id)
        if not day:
            return None
        exercise = await PlanCrudService._get_exercise(session, day.id, plan_exercise_id)
        if not exercise:
            return None
        plan_set = await PlanCrudService._get_set(session, exercise.id, set_id)
        if not plan_set:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan_set, key, value)
        validate_weight_fields(plan_set.target_weight_type, plan_set.target_weight_kg, plan_set.offset_kg)

        session.add(plan_set)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise PlanValidationError(f"Failed to update plan set: {e}") from e
        await session.refresh(plan_set)
        return plan_set

    @staticmethod
    async def delete_set(
        session: AsyncSession,
        plan_id: uuid.UUID,
        day_id: uuid.UUID,
        plan_exercise_id: uuid.UUID,
        set_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        plan = await PlanCrudService._get_owned_plan(session, plan_id, home_id, user_id)
        if not plan:
            return False
        day = await PlanCrudService._get_day(session, plan.id, day_id)
        if not day:
            return False
        exercise = await PlanCrudService._get_exercise(session, day.id, plan_exercise_id)
        if not exercise:
            return False
        plan_set = await PlanCrudService._get_set(session, exercise.id, set_id)
        if not plan_set:
            return False
        await session.delete(plan_set)
        await session.commit()
        return True
