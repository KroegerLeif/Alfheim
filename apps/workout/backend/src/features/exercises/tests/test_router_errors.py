import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.exceptions import ExerciseValidationError
from src.features.exercises.models import Exercise, ExerciseScope, MuscleGroup
from src.features.exercises.schemas import ExerciseCreate, ExerciseUpdate, UserExercisePreferenceUpsert
from src.features.exercises.service import ExerciseService


async def test_exercise_router_not_found_errors(client: AsyncClient):
    """Verify HTTP 404 responses for non-existent exercise resources."""
    random_id = uuid.uuid4()

    res = await client.get(f"/api/v1/exercises/{random_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Exercise not found."

    res = await client.patch(f"/api/v1/exercises/{random_id}", json={"name": "New Name"})
    assert res.status_code == 404
    assert res.json()["detail"] == "Exercise not found."

    res = await client.delete(f"/api/v1/exercises/{random_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Exercise not found."

    res = await client.get(f"/api/v1/exercises/{random_id}/preference")
    assert res.status_code == 404
    assert res.json()["detail"] == "Preference not found."

    res = await client.delete(f"/api/v1/exercises/{random_id}/favorite")
    assert res.status_code == 404
    assert res.json()["detail"] == "Favorite not found."


async def test_exercise_service_edge_cases(db_session: AsyncSession):
    """Verify exercise preference updates, favorite idempotency, and integrity error handling."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    exercise = await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(
            name="Bench Press",
            primary_muscle=MuscleGroup.CHEST,
            is_unilateral=False,
            is_bodyweight=False,
        ),
        home_id=home_id,
        user_id=user_id,
    )

    # Favorite idempotency: adding twice returns the existing one
    fav1 = await ExerciseService.add_favorite(db_session, home_id, user_id, exercise.id)
    fav2 = await ExerciseService.add_favorite(db_session, home_id, user_id, exercise.id)
    assert fav1.id == fav2.id

    # Remove favorite
    assert await ExerciseService.remove_favorite(db_session, home_id, user_id, exercise.id) is True
    # Remove non-existent favorite
    assert await ExerciseService.remove_favorite(db_session, home_id, user_id, exercise.id) is False

    # Upsert preference: insert then update
    pref1 = await ExerciseService.upsert_preference(
        db_session,
        home_id,
        user_id,
        exercise.id,
        UserExercisePreferenceUpsert(default_target_weight_kg=80.0, preferred_unit="kg", notes="Form"),
    )
    assert pref1.default_target_weight_kg == 80.0
    assert pref1.notes == "Form"

    exercise_id = exercise.id

    pref2 = await ExerciseService.upsert_preference(
        db_session,
        home_id,
        user_id,
        exercise_id,
        UserExercisePreferenceUpsert(default_target_weight_kg=85.0, preferred_unit="kg", notes="Strong"),
    )
    assert pref2.id == pref1.id
    assert pref2.default_target_weight_kg == 85.0
    assert pref2.notes == "Strong"

    # System exercise cannot be updated or deleted
    system_ex = Exercise(
        name="Push Up",
        scope=ExerciseScope.SYSTEM,
        primary_muscle=MuscleGroup.CHEST,
        home_id=None,
        owner_user_id=None,
    )
    db_session.add(system_ex)
    await db_session.commit()
    await db_session.refresh(system_ex)
    system_ex_id = system_ex.id

    assert (
        await ExerciseService.update_exercise(
            db_session, system_ex_id, home_id, user_id, ExerciseUpdate(name="Renamed")
        )
        is None
    )
    assert await ExerciseService.delete_exercise(db_session, system_ex_id, home_id, user_id) is False

    # IntegrityError handling
    with (
        patch.object(db_session, "commit", AsyncMock(side_effect=IntegrityError("stmt", "params", Exception("orig")))),
        patch.object(db_session, "rollback", AsyncMock()),
    ):
        with pytest.raises(ExerciseValidationError):
            await ExerciseService.create_exercise(
                db_session,
                ExerciseCreate(name="Fail Ex", primary_muscle=MuscleGroup.QUADS),
                home_id,
                user_id,
            )
        with pytest.raises(ExerciseValidationError):
            await ExerciseService.update_exercise(
                db_session,
                exercise_id,
                home_id,
                user_id,
                ExerciseUpdate(name="Fail Update"),
            )
        with pytest.raises(ExerciseValidationError):
            await ExerciseService.delete_exercise(db_session, exercise_id, home_id, user_id)
