import uuid

from httpx import AsyncClient


async def test_create_and_get_plan(client: AsyncClient):
    payload = {"name": "5x5 Strength", "description": "Classic linear progression", "is_shared": False}
    create_res = await client.post("/api/v1/plans", json=payload)
    assert create_res.status_code == 201
    plan = create_res.json()
    assert plan["name"] == "5x5 Strength"

    get_res = await client.get(f"/api/v1/plans/{plan['id']}")
    assert get_res.status_code == 200


async def test_list_plans(client: AsyncClient):
    await client.post("/api/v1/plans", json={"name": "Plan A"})
    await client.post("/api/v1/plans", json={"name": "Plan B"})

    res = await client.get("/api/v1/plans")
    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_add_day_exercise_and_set(client: AsyncClient):
    exercise_id = str(uuid.uuid4())
    create_res = await client.post("/api/v1/plans", json={"name": "Split"})
    plan_id = create_res.json()["id"]

    day_res = await client.post(f"/api/v1/plans/{plan_id}/days", json={"label": "Pull"})
    assert day_res.status_code == 201
    day_id = day_res.json()["id"]

    ex_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises", json={"exercise_id": exercise_id, "sets": []}
    )
    assert ex_res.status_code == 201
    plan_exercise_id = ex_res.json()["id"]

    set_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets",
        json={"target_reps": 5, "target_weight_type": "absolute", "target_weight_kg": 100.0},
    )
    assert set_res.status_code == 201
    assert set_res.json()["target_weight_kg"] == 100.0


async def test_add_set_with_invalid_weight_combo_returns_400(client: AsyncClient):
    exercise_id = str(uuid.uuid4())
    create_res = await client.post("/api/v1/plans", json={"name": "Bad Plan"})
    plan_id = create_res.json()["id"]
    day_res = await client.post(f"/api/v1/plans/{plan_id}/days", json={"label": "Day 1"})
    day_id = day_res.json()["id"]
    ex_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises", json={"exercise_id": exercise_id, "sets": []}
    )
    plan_exercise_id = ex_res.json()["id"]

    set_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets",
        json={"target_weight_type": "absolute", "target_weight_kg": None},
    )
    assert set_res.status_code == 400


async def test_resolve_day_returns_resolved_weights(client: AsyncClient):
    exercise_id = str(uuid.uuid4())
    create_res = await client.post("/api/v1/plans", json={"name": "Resolved Plan"})
    plan_id = create_res.json()["id"]
    day_res = await client.post(f"/api/v1/plans/{plan_id}/days", json={"label": "Day 1"})
    day_id = day_res.json()["id"]
    ex_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises", json={"exercise_id": exercise_id, "sets": []}
    )
    plan_exercise_id = ex_res.json()["id"]
    await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets",
        json={"target_reps": 5, "target_weight_type": "absolute", "target_weight_kg": 100.0},
    )

    resolved_res = await client.get(f"/api/v1/plans/{plan_id}/days/{day_id}/resolved")
    assert resolved_res.status_code == 200
    data = resolved_res.json()
    assert data["exercises"][0]["sets"][0]["resolved_weight_kg"] == 100.0


async def test_update_set_and_delete_exercise_and_day(client: AsyncClient):
    exercise_id = str(uuid.uuid4())
    create_res = await client.post("/api/v1/plans", json={"name": "Full Lifecycle"})
    plan_id = create_res.json()["id"]
    day_res = await client.post(f"/api/v1/plans/{plan_id}/days", json={"label": "Day 1"})
    day_id = day_res.json()["id"]
    ex_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises", json={"exercise_id": exercise_id, "sets": []}
    )
    plan_exercise_id = ex_res.json()["id"]
    set_res = await client.post(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets",
        json={"target_reps": 8, "target_weight_type": "default"},
    )
    set_id = set_res.json()["id"]

    patch_res = await client.patch(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets/{set_id}",
        json={"target_reps": 6},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["target_reps"] == 6

    del_set_res = await client.delete(
        f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets/{set_id}"
    )
    assert del_set_res.status_code == 204

    del_ex_res = await client.delete(f"/api/v1/plans/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}")
    assert del_ex_res.status_code == 204

    del_day_res = await client.delete(f"/api/v1/plans/{plan_id}/days/{day_id}")
    assert del_day_res.status_code == 204


async def test_delete_plan(client: AsyncClient):
    create_res = await client.post("/api/v1/plans", json={"name": "To Delete"})
    plan_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/plans/{plan_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"/api/v1/plans/{plan_id}")
    assert get_res.status_code == 404
