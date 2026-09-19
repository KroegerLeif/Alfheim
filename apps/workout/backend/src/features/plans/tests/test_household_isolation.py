import uuid

from httpx import AsyncClient


async def test_workout_plans_household_tenant_isolation(client: AsyncClient, member_headers):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = member_headers(home_a)
    headers_b = member_headers(home_b)

    res_a = await client.post("/api/v1/plans", json={"name": "Household A Plan"}, headers=headers_a)
    assert res_a.status_code == 201
    plan_a = res_a.json()

    res_b = await client.get("/api/v1/plans", headers=headers_b)
    assert res_b.status_code == 200
    plans_b = res_b.json()
    assert not any(p["id"] == plan_a["id"] for p in plans_b)

    get_res = await client.get(f"/api/v1/plans/{plan_a['id']}", headers=headers_b)
    assert get_res.status_code == 404


async def test_workout_plans_nested_set_idor_via_guessed_child_id(client: AsyncClient, member_headers):
    """Household B must not reach household A's nested PlanSet even with a guessed/known child ID."""
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())
    exercise_id = str(uuid.uuid4())
    headers_a = member_headers(home_a)
    headers_b = member_headers(home_b)

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


async def test_workout_plans_cross_tenant_idor_header_override_rejected(client: AsyncClient, member_headers):
    home_authorized = uuid.uuid4()
    headers = member_headers(home_authorized)
    headers["X-Household-ID"] = str(uuid.uuid4())  # a household the caller is not a member of

    response = await client.get("/api/v1/plans", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


async def test_workout_plans_private_plan_not_visible_to_other_user_same_household(client: AsyncClient, member_headers):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    headers_a = member_headers(home_id, sub=user_a)
    headers_b = member_headers(home_id, sub=user_b)

    res_a = await client.post("/api/v1/plans", json={"name": "Private", "is_shared": False}, headers=headers_a)
    plan_a = res_a.json()

    get_res = await client.get(f"/api/v1/plans/{plan_a['id']}", headers=headers_b)
    assert get_res.status_code == 404


async def test_workout_plans_shared_plan_visible_but_not_writable_by_other_user(client: AsyncClient, member_headers):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    headers_a = member_headers(home_id, sub=user_a)
    headers_b = member_headers(home_id, sub=user_b)

    res_a = await client.post("/api/v1/plans", json={"name": "Shared", "is_shared": True}, headers=headers_a)
    plan_a = res_a.json()

    get_res = await client.get(f"/api/v1/plans/{plan_a['id']}", headers=headers_b)
    assert get_res.status_code == 200

    patch_res = await client.patch(f"/api/v1/plans/{plan_a['id']}", json={"name": "Hacked"}, headers=headers_b)
    assert patch_res.status_code == 404
