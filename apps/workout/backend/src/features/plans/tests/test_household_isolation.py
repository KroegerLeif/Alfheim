import uuid

import jwt
from httpx import AsyncClient


async def test_workout_plans_household_tenant_isolation(client: AsyncClient):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = {"X-Household-ID": home_a}
    headers_b = {"X-Household-ID": home_b}

    res_a = await client.post("/api/v1/plans", json={"name": "Household A Plan"}, headers=headers_a)
    assert res_a.status_code == 201
    plan_a = res_a.json()

    res_b = await client.get("/api/v1/plans", headers=headers_b)
    assert res_b.status_code == 200
    plans_b = res_b.json()
    assert not any(p["id"] == plan_a["id"] for p in plans_b)

    get_res = await client.get(f"/api/v1/plans/{plan_a['id']}", headers=headers_b)
    assert get_res.status_code == 404


async def test_workout_plans_nested_set_idor_via_guessed_child_id(client: AsyncClient):
    """Household B must not reach household A's nested PlanSet even with a guessed/known child ID."""
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())
    exercise_id = str(uuid.uuid4())
    headers_a = {"X-Household-ID": home_a}
    headers_b = {"X-Household-ID": home_b}

    plan_res = await client.post("/api/v1/plans", json={"name": "Secret Plan"}, headers=headers_a)
    plan_id = plan_res.json()["id"]
    day_res = await client.post(f"/api/v1/plans/{plan_id}/days", json={"label": "Day 1"}, headers=headers_a)
    day_id = day_res.json()["id"]
    ex_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "sets": []},
        headers=headers_a,
    )
    plan_exercise_id = ex_res.json()["id"]
    set_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets",
        json={"target_weight_type": "default"},
        headers=headers_a,
    )
    set_id = set_res.json()["id"]

    # Household B tries to update/delete household A's set using the real child IDs
    # (simulating an attacker who somehow learned the IDs). It must fail because the
    # PLAN itself isn't visible/writable to household B, regardless of nested ID correctness.
    update_res = await client.patch(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets/{set_id}",
        json={"target_reps": 1},
        headers=headers_b,
    )
    assert update_res.status_code == 404

    delete_res = await client.delete(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets/{set_id}",
        headers=headers_b,
    )
    assert delete_res.status_code == 404


async def test_workout_plans_cross_tenant_idor_header_override_rejected(client: AsyncClient):
    home_authorized = str(uuid.uuid4())
    home_unauthorized = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    token = jwt.encode(
        {"sub": user_id, "household_id": home_authorized, "households": [home_authorized]},
        "secret",
        algorithm="HS256",
    )
    auth_headers = {"Authorization": f"Bearer {token}", "X-Household-ID": home_unauthorized}

    response = await client.get("/api/v1/plans", headers=auth_headers)
    assert response.status_code == 403


async def test_workout_plans_private_plan_not_visible_to_other_user_same_household(client: AsyncClient):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    token_a = jwt.encode({"sub": user_a, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")
    token_b = jwt.encode({"sub": user_b, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")
    headers_a = {"Authorization": f"Bearer {token_a}", "X-Household-ID": home_id}
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Household-ID": home_id}

    res_a = await client.post("/api/v1/plans", json={"name": "Private", "is_shared": False}, headers=headers_a)
    plan_a = res_a.json()

    get_res = await client.get(f"/api/v1/plans/{plan_a['id']}", headers=headers_b)
    assert get_res.status_code == 404


async def test_workout_plans_shared_plan_visible_but_not_writable_by_other_user(client: AsyncClient):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    token_a = jwt.encode({"sub": user_a, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")
    token_b = jwt.encode({"sub": user_b, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")
    headers_a = {"Authorization": f"Bearer {token_a}", "X-Household-ID": home_id}
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Household-ID": home_id}

    res_a = await client.post("/api/v1/plans", json={"name": "Shared", "is_shared": True}, headers=headers_a)
    plan_a = res_a.json()

    get_res = await client.get(f"/api/v1/plans/{plan_a['id']}", headers=headers_b)
    assert get_res.status_code == 200

    patch_res = await client.patch(f"/api/v1/plans/{plan_a['id']}", json={"name": "Hacked"}, headers=headers_b)
    assert patch_res.status_code == 404
