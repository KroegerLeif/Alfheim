import uuid

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession


@pytest.fixture(autouse=True)
async def seed_exercises(db_session: AsyncSession):
    """Seed default system exercises dynamically for exercises tests."""
    from src.features.exercises.seeder import seed_default_exercises

    await seed_default_exercises(db_session)
    await db_session.commit()


async def test_startup_seeds_system_exercises(client: AsyncClient):
    response = await client.get("/api/v1/exercises")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert all(item["scope"] == "system" for item in data)


async def test_create_household_exercise(client: AsyncClient):
    payload = {"name": "Custom Row", "primary_muscle": "back", "scope": "household"}
    response = await client.post("/api/v1/exercises", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Custom Row"
    assert data["scope"] == "household"


async def test_create_system_exercise_via_api_rejected(client: AsyncClient):
    payload = {"name": "Hack", "primary_muscle": "core", "scope": "system"}
    response = await client.post("/api/v1/exercises", json=payload)
    assert response.status_code == 400


async def test_get_exercise_by_id(client: AsyncClient):
    create_res = await client.post(
        "/api/v1/exercises", json={"name": "Cable Fly", "primary_muscle": "chest", "scope": "household"}
    )
    exercise_id = create_res.json()["id"]

    response = await client.get(f"/api/v1/exercises/{exercise_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Cable Fly"

    fake_id = uuid.uuid4()
    response = await client.get(f"/api/v1/exercises/{fake_id}")
    assert response.status_code == 404


async def test_update_exercise(client: AsyncClient):
    create_res = await client.post(
        "/api/v1/exercises", json={"name": "Old Name", "primary_muscle": "core", "scope": "household"}
    )
    exercise_id = create_res.json()["id"]

    patch_res = await client.patch(f"/api/v1/exercises/{exercise_id}", json={"name": "New Name"})
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "New Name"


async def test_update_system_exercise_returns_404(client: AsyncClient):
    list_res = await client.get("/api/v1/exercises")
    system_id = list_res.json()[0]["id"]

    patch_res = await client.patch(f"/api/v1/exercises/{system_id}", json={"name": "Hacked"})
    assert patch_res.status_code == 404


async def test_delete_exercise(client: AsyncClient):
    create_res = await client.post(
        "/api/v1/exercises", json={"name": "Temp Item", "primary_muscle": "core", "scope": "household"}
    )
    exercise_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/exercises/{exercise_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"/api/v1/exercises/{exercise_id}")
    assert get_res.status_code == 404


async def test_preference_put_and_get(client: AsyncClient):
    create_res = await client.post(
        "/api/v1/exercises", json={"name": "Bench Press", "primary_muscle": "chest", "scope": "household"}
    )
    exercise_id = create_res.json()["id"]

    put_res = await client.put(
        f"/api/v1/exercises/{exercise_id}/preference",
        json={"default_target_weight_kg": 80.0, "preferred_unit": "kg", "notes": "Warm up first"},
    )
    assert put_res.status_code == 200
    assert put_res.json()["default_target_weight_kg"] == 80.0

    get_res = await client.get(f"/api/v1/exercises/{exercise_id}/preference")
    assert get_res.status_code == 200
    assert get_res.json()["notes"] == "Warm up first"


async def test_get_preference_404_when_absent(client: AsyncClient):
    create_res = await client.post(
        "/api/v1/exercises", json={"name": "No Pref Exercise", "primary_muscle": "core", "scope": "household"}
    )
    exercise_id = create_res.json()["id"]

    get_res = await client.get(f"/api/v1/exercises/{exercise_id}/preference")
    assert get_res.status_code == 404


async def test_favorite_and_unfavorite(client: AsyncClient):
    create_res = await client.post(
        "/api/v1/exercises", json={"name": "Favorite Exercise", "primary_muscle": "back", "scope": "household"}
    )
    exercise_id = create_res.json()["id"]

    fav_res = await client.post(f"/api/v1/exercises/{exercise_id}/favorite")
    assert fav_res.status_code == 201
    assert fav_res.json()["exercise_id"] == exercise_id

    list_res = await client.get("/api/v1/exercises/favorites")
    assert list_res.status_code == 200
    assert any(e["id"] == exercise_id for e in list_res.json())

    unfav_res = await client.delete(f"/api/v1/exercises/{exercise_id}/favorite")
    assert unfav_res.status_code == 204

    list_res_after = await client.get("/api/v1/exercises/favorites")
    assert not any(e["id"] == exercise_id for e in list_res_after.json())


async def test_unfavorite_returns_404_when_absent(client: AsyncClient):
    create_res = await client.post(
        "/api/v1/exercises", json={"name": "Never Favorited", "primary_muscle": "core", "scope": "household"}
    )
    exercise_id = create_res.json()["id"]

    unfav_res = await client.delete(f"/api/v1/exercises/{exercise_id}/favorite")
    assert unfav_res.status_code == 404
