import uuid

from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.models import Exercise, ExerciseFavorite, ExerciseScope, MuscleGroup
from src.features.exercises.service import ExerciseService


async def test_favorite_rejects_exercise_of_other_household(client: AsyncClient, member_headers, make_api_exercise):
    headers_a = member_headers(str(uuid.uuid4()))
    headers_b = member_headers(str(uuid.uuid4()))
    exercise_id = await make_api_exercise(headers=headers_a, name="Household A Deadlift")

    fav_res = await client.post(f"/api/v1/exercises/{exercise_id}/favorite", headers=headers_b)
    assert fav_res.status_code == 400

    list_res = await client.get("/api/v1/exercises/favorites", headers=headers_b)
    assert list_res.status_code == 200
    assert list_res.json() == []


async def test_favorite_rejects_private_exercise_of_other_user_same_household(
    client: AsyncClient, member_headers, make_api_exercise
):
    home_id = str(uuid.uuid4())
    headers_a = member_headers(home_id, sub=str(uuid.uuid4()))
    headers_b = member_headers(home_id, sub=str(uuid.uuid4()))
    exercise_id = await make_api_exercise(headers=headers_a, name="Private Curl", scope="user")

    fav_res = await client.post(f"/api/v1/exercises/{exercise_id}/favorite", headers=headers_b)
    assert fav_res.status_code == 400


async def test_favorite_allows_visible_household_exercise(client: AsyncClient, member_headers, make_api_exercise):
    home_id = str(uuid.uuid4())
    headers_a = member_headers(home_id, sub=str(uuid.uuid4()))
    headers_b = member_headers(home_id, sub=str(uuid.uuid4()))
    exercise_id = await make_api_exercise(headers=headers_a, name="Shared Squat")

    fav_res = await client.post(f"/api/v1/exercises/{exercise_id}/favorite", headers=headers_b)
    assert fav_res.status_code == 201

    list_res = await client.get("/api/v1/exercises/favorites", headers=headers_b)
    assert [e["id"] for e in list_res.json()] == [exercise_id]


async def test_list_favorites_hides_exercises_that_are_not_visible(db_session: AsyncSession):
    """A pre-existing favorite row pointing at an invisible exercise must not leak the exercise."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    foreign = Exercise(
        scope=ExerciseScope.HOUSEHOLD, home_id=uuid.uuid4(), name="Foreign", primary_muscle=MuscleGroup.CHEST
    )
    db_session.add(foreign)
    await db_session.commit()
    db_session.add(ExerciseFavorite(home_id=home_id, user_id=user_id, exercise_id=foreign.id))
    await db_session.commit()

    assert list(await ExerciseService.list_favorite_exercises(db_session, home_id, user_id)) == []
