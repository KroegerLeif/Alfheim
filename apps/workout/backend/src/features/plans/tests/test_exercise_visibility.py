import uuid

from httpx import AsyncClient


async def test_plans_reject_exercise_of_other_household(client: AsyncClient, member_headers, make_api_exercise):
    headers_a = member_headers(str(uuid.uuid4()))
    headers_b = member_headers(str(uuid.uuid4()))
    foreign_exercise_id = await make_api_exercise(headers=headers_a, name="Household A Row")
    nested_days = [{"label": "D", "exercises": [{"exercise_id": foreign_exercise_id, "sets": []}]}]

    create_res = await client.post("/api/v1/plans", json={"name": "Smuggle", "days": nested_days}, headers=headers_b)
    assert create_res.status_code == 400

    plan_res = await client.post("/api/v1/plans", json={"name": "Own plan"}, headers=headers_b)
    plan_id = plan_res.json()["id"]
    day_res = await client.post(f"/api/v1/plans/{plan_id}/days", json={"label": "Day"}, headers=headers_b)
    day_id = day_res.json()["id"]

    add_exercise_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises",
        json={"exercise_id": foreign_exercise_id, "sets": []},
        headers=headers_b,
    )
    assert add_exercise_res.status_code == 400

    add_day_res = await client.post(
        f"/api/v1/plans/{plan_id}/days",
        json={"label": "Day 2", "exercises": nested_days[0]["exercises"]},
        headers=headers_b,
    )
    assert add_day_res.status_code == 400

    update_res = await client.patch(f"/api/v1/plans/{plan_id}", json={"days": nested_days}, headers=headers_b)
    assert update_res.status_code == 400


async def test_plans_reject_private_exercise_of_other_user_same_household(
    client: AsyncClient, member_headers, make_api_exercise
):
    home_id = str(uuid.uuid4())
    headers_a = member_headers(home_id, sub=str(uuid.uuid4()))
    headers_b = member_headers(home_id, sub=str(uuid.uuid4()))
    private_id = await make_api_exercise(headers=headers_a, name="Private Press", scope="user")

    res = await client.post(
        "/api/v1/plans",
        json={"name": "Smuggle", "days": [{"label": "D", "exercises": [{"exercise_id": private_id, "sets": []}]}]},
        headers=headers_b,
    )
    assert res.status_code == 400


async def test_plans_accept_visible_household_exercise(client: AsyncClient, member_headers, make_api_exercise):
    home_id = str(uuid.uuid4())
    headers_a = member_headers(home_id, sub=str(uuid.uuid4()))
    headers_b = member_headers(home_id, sub=str(uuid.uuid4()))
    shared_id = await make_api_exercise(headers=headers_a, name="Shared Bench")

    res = await client.post(
        "/api/v1/plans",
        json={"name": "Ok", "days": [{"label": "D", "exercises": [{"exercise_id": shared_id, "sets": []}]}]},
        headers=headers_b,
    )
    assert res.status_code == 201
