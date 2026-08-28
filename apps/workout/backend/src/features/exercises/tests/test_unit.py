import uuid

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.exceptions import ExerciseValidationError
from src.features.exercises.models import ExerciseScope, MuscleGroup
from src.features.exercises.schemas import ExerciseCreate, ExerciseUpdate, UserExercisePreferenceUpsert
from src.features.exercises.service import ExerciseService


async def test_create_household_exercise_sets_home_id(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    payload = ExerciseCreate(name="Barbell Squat", primary_muscle=MuscleGroup.QUADS, scope=ExerciseScope.HOUSEHOLD)

    exercise = await ExerciseService.create_exercise(db_session, payload, home_id, user_id)

    assert exercise.home_id == home_id
    assert exercise.owner_user_id is None
    assert exercise.scope == ExerciseScope.HOUSEHOLD


async def test_create_user_exercise_sets_owner_only(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    payload = ExerciseCreate(name="Custom Curl", primary_muscle=MuscleGroup.BICEPS, scope=ExerciseScope.USER)

    exercise = await ExerciseService.create_exercise(db_session, payload, home_id, user_id)

    assert exercise.owner_user_id == user_id
    assert exercise.home_id is None


async def test_create_system_exercise_via_api_rejected(db_session: AsyncSession):
    payload = ExerciseCreate(name="Hack", primary_muscle=MuscleGroup.CORE, scope=ExerciseScope.SYSTEM)

    with pytest.raises(ExerciseValidationError):
        await ExerciseService.create_exercise(db_session, payload, uuid.uuid4(), uuid.uuid4())


async def test_list_exercises_returns_system_and_own_household(db_session: AsyncSession):
    home_id = uuid.uuid4()
    other_home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(name="My Squat", primary_muscle=MuscleGroup.QUADS, scope=ExerciseScope.HOUSEHOLD),
        home_id,
        user_id,
    )
    await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(name="Other Squat", primary_muscle=MuscleGroup.QUADS, scope=ExerciseScope.HOUSEHOLD),
        other_home_id,
        user_id,
    )

    results = await ExerciseService.list_exercises(db_session, home_id, user_id)
    names = {e.name for e in results}

    assert "My Squat" in names
    assert "Other Squat" not in names


async def test_update_system_exercise_not_writable(db_session: AsyncSession):
    from src.features.exercises.models import Exercise

    system_item = Exercise(scope=ExerciseScope.SYSTEM, name="Deadlift", primary_muscle=MuscleGroup.BACK)
    db_session.add(system_item)
    await db_session.commit()
    await db_session.refresh(system_item)

    result = await ExerciseService.update_exercise(
        db_session, system_item.id, uuid.uuid4(), uuid.uuid4(), ExerciseUpdate(name="Hacked")
    )

    assert result is None


async def test_delete_exercise_removes_row(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    exercise = await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(name="Temp Exercise", primary_muscle=MuscleGroup.CORE, scope=ExerciseScope.HOUSEHOLD),
        home_id,
        user_id,
    )

    deleted = await ExerciseService.delete_exercise(db_session, exercise.id, home_id, user_id)
    assert deleted is True

    fetched = await ExerciseService.get_exercise(db_session, exercise.id, home_id, user_id)
    assert fetched is None


async def test_upsert_preference_creates_then_updates(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    exercise = await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(name="Bench Press", primary_muscle=MuscleGroup.CHEST, scope=ExerciseScope.HOUSEHOLD),
        home_id,
        user_id,
    )

    created = await ExerciseService.upsert_preference(
        db_session,
        home_id,
        user_id,
        exercise.id,
        UserExercisePreferenceUpsert(default_target_weight_kg=60.0, preferred_unit="kg"),
    )
    assert created.default_target_weight_kg == 60.0

    updated = await ExerciseService.upsert_preference(
        db_session,
        home_id,
        user_id,
        exercise.id,
        UserExercisePreferenceUpsert(default_target_weight_kg=65.0),
    )
    assert updated.id == created.id
    assert updated.default_target_weight_kg == 65.0


async def test_upsert_preference_rejects_invisible_exercise(db_session: AsyncSession):
    other_home_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    exercise = await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(name="Private Exercise", primary_muscle=MuscleGroup.CORE, scope=ExerciseScope.HOUSEHOLD),
        other_home_id,
        other_user_id,
    )

    with pytest.raises(ExerciseValidationError):
        await ExerciseService.upsert_preference(
            db_session,
            uuid.uuid4(),
            uuid.uuid4(),
            exercise.id,
            UserExercisePreferenceUpsert(notes="nope"),
        )


async def test_add_favorite_is_idempotent(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    exercise = await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(name="Favorite Me", primary_muscle=MuscleGroup.BACK, scope=ExerciseScope.HOUSEHOLD),
        home_id,
        user_id,
    )

    first = await ExerciseService.add_favorite(db_session, home_id, user_id, exercise.id)
    second = await ExerciseService.add_favorite(db_session, home_id, user_id, exercise.id)

    assert first.id == second.id

    favorites = await ExerciseService.list_favorites(db_session, home_id, user_id)
    assert len(favorites) == 1


async def test_remove_favorite_deletes_row(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    exercise = await ExerciseService.create_exercise(
        db_session,
        ExerciseCreate(name="Unfavorite Me", primary_muscle=MuscleGroup.BACK, scope=ExerciseScope.HOUSEHOLD),
        home_id,
        user_id,
    )
    await ExerciseService.add_favorite(db_session, home_id, user_id, exercise.id)

    deleted = await ExerciseService.remove_favorite(db_session, home_id, user_id, exercise.id)
    assert deleted is True

    deleted_again = await ExerciseService.remove_favorite(db_session, home_id, user_id, exercise.id)
    assert deleted_again is False
