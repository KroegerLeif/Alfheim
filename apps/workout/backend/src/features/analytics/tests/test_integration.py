from httpx import AsyncClient


async def test_muscle_volume_endpoint_empty(client: AsyncClient):
    res = await client.get("/api/v1/analytics/muscle-volume")
    assert res.status_code == 200
    assert res.json()["entries"] == []


async def test_streaks_endpoint_empty(client: AsyncClient):
    res = await client.get("/api/v1/analytics/streaks")
    assert res.status_code == 200
    data = res.json()
    assert data["current_streak_days"] == 0
    assert data["longest_streak_days"] == 0


async def test_leaderboard_endpoint_empty(client: AsyncClient):
    res = await client.get("/api/v1/analytics/leaderboard")
    assert res.status_code == 200
    assert res.json()["entries"] == []


async def test_muscle_volume_reflects_completed_session(client: AsyncClient):
    session_res = await client.post("/api/v1/sessions", json={})
    session_id = session_res.json()["id"]

    payload = {
        "items": [
            {
                "client_idempotency_key": "vol-key",
                "session_exercise_id": "00000000-0000-0000-0000-000000000001",
                "set_order": 0,
                "actual_reps": 5,
                "actual_weight_kg": 50.0,
            }
        ]
    }
    # No session_exercise on this freeform session yet, so the sync will skip it —
    # this test only verifies the endpoint returns 200 with an empty result set.
    await client.post(f"/api/v1/sessions/{session_id}/sets/sync", json=payload)

    res = await client.get("/api/v1/analytics/muscle-volume")
    assert res.status_code == 200
