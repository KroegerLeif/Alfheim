import uuid

import jwt
from httpx import AsyncClient


async def test_workout_exercises_household_tenant_isolation(client: AsyncClient):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = {"X-Household-ID": home_a}
    headers_b = {"X-Household-ID": home_b}

    res_a = await client.post(
        "/api/v1/exercises",
        json={"name": "Household A Squat", "primary_muscle": "quads", "scope": "household"},
        headers=headers_a,
    )
    assert res_a.status_code == 201
    exercise_a = res_a.json()

    res_b = await client.get("/api/v1/exercises", headers=headers_b)
    assert res_b.status_code == 200
    exercises_b = res_b.json()
    assert not any(e["id"] == exercise_a["id"] for e in exercises_b)

    get_res = await client.get(f"/api/v1/exercises/{exercise_a['id']}", headers=headers_b)
    assert get_res.status_code == 404


async def test_workout_exercises_cross_tenant_idor_header_override_rejected(client: AsyncClient):
    home_authorized = str(uuid.uuid4())
    home_unauthorized = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    token = jwt.encode(
        {"sub": user_id, "household_id": home_authorized, "households": [home_authorized]},
        "secret",
        algorithm="HS256",
    )
    auth_headers = {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": home_unauthorized,
    }

    response = await client.get("/api/v1/exercises", headers=auth_headers)
    assert response.status_code == 403
    assert "forbidden" in response.json()["detail"].lower()


async def test_workout_exercises_authorized_household_header_override_allowed(client: AsyncClient):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    token = jwt.encode(
        {"sub": user_id, "household_id": home_a, "households": [home_a, home_b]},
        "secret",
        algorithm="HS256",
    )
    auth_headers = {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": home_b,
    }

    response = await client.get("/api/v1/exercises", headers=auth_headers)
    assert response.status_code == 200


async def test_workout_exercises_user_scope_not_visible_to_other_user_same_household(client: AsyncClient):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    token_a = jwt.encode({"sub": user_a, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")
    token_b = jwt.encode({"sub": user_b, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")

    headers_a = {"Authorization": f"Bearer {token_a}", "X-Household-ID": home_id}
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Household-ID": home_id}

    res_a = await client.post(
        "/api/v1/exercises",
        json={"name": "User A's Own Curl", "primary_muscle": "biceps", "scope": "user"},
        headers=headers_a,
    )
    assert res_a.status_code == 201
    exercise_a = res_a.json()

    res_b = await client.get("/api/v1/exercises", headers=headers_b)
    exercises_b = res_b.json()
    assert not any(e["id"] == exercise_a["id"] for e in exercises_b)


async def test_workout_exercise_preference_not_visible_to_other_user_same_household(client: AsyncClient):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    token_a = jwt.encode({"sub": user_a, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")
    token_b = jwt.encode({"sub": user_b, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")

    headers_a = {"Authorization": f"Bearer {token_a}", "X-Household-ID": home_id}
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Household-ID": home_id}

    create_res = await client.post(
        "/api/v1/exercises",
        json={"name": "Shared Household Bench", "primary_muscle": "chest", "scope": "household"},
        headers=headers_a,
    )
    assert create_res.status_code == 201
    exercise_id = create_res.json()["id"]

    put_res = await client.put(
        f"/api/v1/exercises/{exercise_id}/preference",
        json={"default_target_weight_kg": 100.0, "notes": "User A's private note"},
        headers=headers_a,
    )
    assert put_res.status_code == 200

    get_res_a = await client.get(f"/api/v1/exercises/{exercise_id}/preference", headers=headers_a)
    assert get_res_a.status_code == 200
    assert get_res_a.json()["default_target_weight_kg"] == 100.0

    get_res_b = await client.get(f"/api/v1/exercises/{exercise_id}/preference", headers=headers_b)
    assert get_res_b.status_code == 404
