import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.plans.exceptions import PlanValidationError
from src.features.plans.models import TargetWeightType
from src.features.plans.schemas import (
    PlanCreate,
    PlanDayCreate,
    PlanExerciseCreate,
    PlanSetCreate,
    PlanSetUpdate,
    PlanUpdate,
)
from src.features.plans.services.plan_crud_service import PlanCrudService


async def test_plans_router_not_found_errors(client: AsyncClient):
    """Verify HTTP 404 responses for non-existent plans and nested resources."""
    random_id = uuid.uuid4()
    dummy_day_id = uuid.uuid4()
    dummy_ex_id = uuid.uuid4()
    dummy_set_id = uuid.uuid4()

    # Plan endpoints
    res = await client.get(f"/api/v1/plans/{random_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan not found."

    res = await client.patch(f"/api/v1/plans/{random_id}", json={"name": "New Name"})
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan not found."

    res = await client.delete(f"/api/v1/plans/{random_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan not found."

    # Plan Day endpoints
    res = await client.post(f"/api/v1/plans/{random_id}/days", json={"label": "Legs"})
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan not found."

    res = await client.delete(f"/api/v1/plans/{random_id}/days/{dummy_day_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan day not found."

    res = await client.get(f"/api/v1/plans/{random_id}/days/{dummy_day_id}/resolved")
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan day not found."

    # Plan Exercise endpoints
    res = await client.post(
        f"/api/v1/plans/{random_id}/days/{dummy_day_id}/exercises",
        json={"exercise_id": str(uuid.uuid4()), "sets": []},
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan day not found."

    res = await client.delete(f"/api/v1/plans/{random_id}/days/{dummy_day_id}/exercises/{dummy_ex_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan exercise not found."

    # Plan Set endpoints
    res = await client.post(
        f"/api/v1/plans/{random_id}/days/{dummy_day_id}/exercises/{dummy_ex_id}/sets",
        json={"target_reps": 10, "target_weight_type": "default"},
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan exercise not found."

    res = await client.patch(
        f"/api/v1/plans/{random_id}/days/{dummy_day_id}/exercises/{dummy_ex_id}/sets/{dummy_set_id}",
        json={"target_reps": 12},
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan set not found."

    res = await client.delete(
        f"/api/v1/plans/{random_id}/days/{dummy_day_id}/exercises/{dummy_ex_id}/sets/{dummy_set_id}"
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Plan set not found."


async def test_plan_crud_service_missing_entities(db_session: AsyncSession):
    """Verify that PlanCrudService returns False or None when sub-resources are absent."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(name="Base Plan", days=[]),
        home_id,
        user_id,
    )

    fake_id = uuid.uuid4()
    # Delete non-existent day
    assert await PlanCrudService.delete_day(db_session, plan.id, fake_id, home_id, user_id) is False
    # Add exercise to non-existent day
    assert (
        await PlanCrudService.add_exercise(
            db_session,
            plan.id,
            fake_id,
            home_id,
            user_id,
            PlanExerciseCreate(exercise_id=uuid.uuid4(), sets=[]),
        )
        is None
    )
    # Delete non-existent exercise
    assert await PlanCrudService.delete_exercise(db_session, plan.id, fake_id, fake_id, home_id, user_id) is False
    # Add set to non-existent exercise
    assert (
        await PlanCrudService.add_set(
            db_session,
            plan.id,
            fake_id,
            fake_id,
            home_id,
            user_id,
            PlanSetCreate(target_reps=5, target_weight_type=TargetWeightType.DEFAULT),
        )
        is None
    )
    # Update non-existent set
    assert (
        await PlanCrudService.update_set(
            db_session,
            plan.id,
            fake_id,
            fake_id,
            fake_id,
            home_id,
            user_id,
            PlanSetUpdate(target_reps=6),
        )
        is None
    )
    # Delete non-existent set
    assert await PlanCrudService.delete_set(db_session, plan.id, fake_id, fake_id, fake_id, home_id, user_id) is False


async def test_plan_crud_service_integrity_errors(db_session: AsyncSession):
    """Verify that DB IntegrityErrors are captured and re-raised as PlanValidationError."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(name="Base Plan", days=[PlanDayCreate(label="Day 1", exercises=[])]),
        home_id,
        user_id,
    )
    plan_id = plan.id
    day_id = plan.days[0].id

    with (
        patch.object(db_session, "commit", AsyncMock(side_effect=IntegrityError("stmt", "params", Exception("orig")))),
        patch.object(db_session, "rollback", AsyncMock()),
    ):
        with pytest.raises(PlanValidationError):
            await PlanCrudService.create_plan(db_session, PlanCreate(name="Plan Fail"), home_id, user_id)

        with pytest.raises(PlanValidationError):
            await PlanCrudService.update_plan(
                db_session, plan_id, home_id, user_id, PlanUpdate(name="Plan Update Fail")
            )

        with pytest.raises(PlanValidationError):
            await PlanCrudService.add_day(db_session, plan_id, home_id, user_id, PlanDayCreate(label="Day Fail"))

        with pytest.raises(PlanValidationError):
            await PlanCrudService.add_exercise(
                db_session,
                plan_id,
                day_id,
                home_id,
                user_id,
                PlanExerciseCreate(exercise_id=uuid.uuid4(), sets=[]),
            )


async def test_plan_crud_service_sets_and_subresources(db_session: AsyncSession):
    """Verify set operations and sub-resource deletions on plans."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ex_id = uuid.uuid4()

    plan = await PlanCrudService.create_plan(
        db_session,
        PlanCreate(
            name="Set CRUD Plan",
            days=[
                PlanDayCreate(
                    label="Day 1",
                    exercises=[
                        PlanExerciseCreate(
                            exercise_id=ex_id,
                            sets=[
                                PlanSetCreate(
                                    target_reps=10,
                                    target_weight_type=TargetWeightType.ABSOLUTE,
                                    target_weight_kg=50.0,
                                )
                            ],
                        )
                    ],
                )
            ],
        ),
        home_id,
        user_id,
    )

    day_id = plan.days[0].id
    plan_ex_id = plan.days[0].exercises[0].id
    assert plan.days[0].exercises[0].sets[0].id is not None

    # Add set
    new_set = await PlanCrudService.add_set(
        db_session,
        plan.id,
        day_id,
        plan_ex_id,
        home_id,
        user_id,
        PlanSetCreate(
            target_reps=8,
            target_weight_type=TargetWeightType.ABSOLUTE,
            target_weight_kg=55.0,
        ),
    )
    assert new_set is not None
    assert new_set.target_reps == 8

    # Update set
    updated_set = await PlanCrudService.update_set(
        db_session,
        plan.id,
        day_id,
        plan_ex_id,
        new_set.id,
        home_id,
        user_id,
        PlanSetUpdate(target_reps=12),
    )
    assert updated_set is not None
    assert updated_set.target_reps == 12

    # Delete set
    deleted_set = await PlanCrudService.delete_set(
        db_session,
        plan.id,
        day_id,
        plan_ex_id,
        new_set.id,
        home_id,
        user_id,
    )
    assert deleted_set is True

    # Delete exercise
    deleted_ex = await PlanCrudService.delete_exercise(
        db_session,
        plan.id,
        day_id,
        plan_ex_id,
        home_id,
        user_id,
    )
    assert deleted_ex is True


async def test_health_check_endpoint(client: AsyncClient):
    """Verify health check endpoint returns 200."""
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
