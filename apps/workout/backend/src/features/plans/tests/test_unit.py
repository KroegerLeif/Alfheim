import uuid

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.plans.exceptions import PlanValidationError
from src.features.plans.models import TargetWeightType
from src.features.plans.schemas import PlanCreate, PlanDayCreate, PlanExerciseCreate, PlanSetCreate
from src.features.plans.services.plan_crud_service import PlanCrudService


def _nested_plan_payload() -> PlanCreate:
    return PlanCreate(
        name="Push Pull Legs",
        is_shared=False,
        days=[
            PlanDayCreate(
                label="Push",
                exercises=[
                    PlanExerciseCreate(
                        exercise_id=uuid.uuid4(),
                        sets=[
                            PlanSetCreate(
                                target_reps=5, target_weight_type=TargetWeightType.ABSOLUTE, target_weight_kg=80.0
                            ),
                            PlanSetCreate(target_reps=8, target_weight_type=TargetWeightType.DEFAULT),
                        ],
                    )
                ],
            )
        ],
    )


async def test_create_plan_persists_nested_structure(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    plan = await PlanCrudService.create_plan(db_session, _nested_plan_payload(), home_id, user_id)

    assert plan.home_id == home_id
    assert plan.owner_user_id == user_id
    assert len(plan.days) == 1
    assert plan.days[0].label == "Push"
    assert len(plan.days[0].exercises) == 1
    assert len(plan.days[0].exercises[0].sets) == 2


async def test_create_plan_rejects_invalid_weight_field_combo(db_session: AsyncSession):
    payload = PlanCreate(
        name="Bad Plan",
        days=[
            PlanDayCreate(
                label="Day 1",
                exercises=[
                    PlanExerciseCreate(
                        exercise_id=uuid.uuid4(),
                        sets=[PlanSetCreate(target_weight_type=TargetWeightType.ABSOLUTE, target_weight_kg=None)],
                    )
                ],
            )
        ],
    )
    with pytest.raises(PlanValidationError):
        await PlanCrudService.create_plan(db_session, payload, uuid.uuid4(), uuid.uuid4())


async def test_shared_plan_visible_to_other_household_member(db_session: AsyncSession):
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    other_user_id = uuid.uuid4()

    payload = PlanCreate(name="Shared Plan", is_shared=True)
    plan = await PlanCrudService.create_plan(db_session, payload, home_id, owner_id)

    fetched = await PlanCrudService.get_plan(db_session, plan.id, home_id, other_user_id)
    assert fetched is not None
    assert fetched.id == plan.id


async def test_unshared_plan_not_visible_to_other_household_member(db_session: AsyncSession):
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    other_user_id = uuid.uuid4()

    payload = PlanCreate(name="Private Plan", is_shared=False)
    plan = await PlanCrudService.create_plan(db_session, payload, home_id, owner_id)

    fetched = await PlanCrudService.get_plan(db_session, plan.id, home_id, other_user_id)
    assert fetched is None


async def test_only_owner_can_update_shared_plan(db_session: AsyncSession):
    from src.features.plans.schemas import PlanUpdate

    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    other_user_id = uuid.uuid4()

    plan = await PlanCrudService.create_plan(
        db_session, PlanCreate(name="Shared Plan", is_shared=True), home_id, owner_id
    )

    result = await PlanCrudService.update_plan(db_session, plan.id, home_id, other_user_id, PlanUpdate(name="Hacked"))
    assert result is None

    result = await PlanCrudService.update_plan(db_session, plan.id, home_id, owner_id, PlanUpdate(name="Renamed"))
    assert result is not None
    assert result.name == "Renamed"


async def test_add_and_delete_day(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    plan = await PlanCrudService.create_plan(db_session, PlanCreate(name="Empty Plan"), home_id, user_id)

    day = await PlanCrudService.add_day(db_session, plan.id, home_id, user_id, PlanDayCreate(label="Legs"))
    assert day is not None
    assert day.label == "Legs"

    deleted = await PlanCrudService.delete_day(db_session, plan.id, day.id, home_id, user_id)
    assert deleted is True


async def test_add_update_and_delete_exercise_and_set(db_session: AsyncSession):
    from src.features.plans.schemas import PlanSetUpdate

    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    exercise_id = uuid.uuid4()
    plan = await PlanCrudService.create_plan(db_session, PlanCreate(name="Empty Plan"), home_id, user_id)
    day = await PlanCrudService.add_day(db_session, plan.id, home_id, user_id, PlanDayCreate(label="Push"))
    assert day is not None

    plan_exercise = await PlanCrudService.add_exercise(
        db_session, plan.id, day.id, home_id, user_id, PlanExerciseCreate(exercise_id=exercise_id, sets=[])
    )
    assert plan_exercise is not None
    assert plan_exercise.exercise_order == 0

    plan_set = await PlanCrudService.add_set(
        db_session,
        plan.id,
        day.id,
        plan_exercise.id,
        home_id,
        user_id,
        PlanSetCreate(target_reps=10, target_weight_type=TargetWeightType.DEFAULT),
    )
    assert plan_set is not None
    assert plan_set.target_reps == 10

    updated = await PlanCrudService.update_set(
        db_session,
        plan.id,
        day.id,
        plan_exercise.id,
        plan_set.id,
        home_id,
        user_id,
        PlanSetUpdate(target_reps=12),
    )
    assert updated is not None
    assert updated.target_reps == 12

    set_deleted = await PlanCrudService.delete_set(
        db_session, plan.id, day.id, plan_exercise.id, plan_set.id, home_id, user_id
    )
    assert set_deleted is True

    exercise_deleted = await PlanCrudService.delete_exercise(
        db_session, plan.id, day.id, plan_exercise.id, home_id, user_id
    )
    assert exercise_deleted is True


async def test_nested_lookups_return_none_for_wrong_parent_chain(db_session: AsyncSession):
    """A day/exercise/set ID that's real but doesn't belong to the given parent chain is rejected."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    plan_a = await PlanCrudService.create_plan(db_session, PlanCreate(name="Plan A"), home_id, user_id)
    plan_b = await PlanCrudService.create_plan(db_session, PlanCreate(name="Plan B"), home_id, user_id)
    day_a = await PlanCrudService.add_day(db_session, plan_a.id, home_id, user_id, PlanDayCreate(label="Day A"))
    assert day_a is not None

    # day_a exists, but doesn't belong to plan_b — must be rejected.
    result = await PlanCrudService.add_exercise(
        db_session, plan_b.id, day_a.id, home_id, user_id, PlanExerciseCreate(exercise_id=uuid.uuid4(), sets=[])
    )
    assert result is None

    deleted = await PlanCrudService.delete_day(db_session, plan_b.id, day_a.id, home_id, user_id)
    assert deleted is False
