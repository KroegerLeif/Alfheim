from httpx import AsyncClient


async def test_start_and_get_freeform_session(client: AsyncClient):
    create_res = await client.post("/api/v1/sessions", json={})
    assert create_res.status_code == 201
    session = create_res.json()
    assert session["status"] == "active"

    get_res = await client.get(f"/api/v1/sessions/{session['id']}")
    assert get_res.status_code == 200


async def test_list_sessions(client: AsyncClient):
    await client.post("/api/v1/sessions", json={})
    await client.post("/api/v1/sessions", json={})

    res = await client.get("/api/v1/sessions")
    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_complete_session(client: AsyncClient):
    create_res = await client.post("/api/v1/sessions", json={})
    session_id = create_res.json()["id"]

    complete_res = await client.post(f"/api/v1/sessions/{session_id}/complete")
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"


async def test_complete_twice_returns_400(client: AsyncClient):
    create_res = await client.post("/api/v1/sessions", json={})
    session_id = create_res.json()["id"]
    await client.post(f"/api/v1/sessions/{session_id}/complete")

    res = await client.post(f"/api/v1/sessions/{session_id}/complete")
    assert res.status_code == 400


async def test_get_nonexistent_session_returns_404(client: AsyncClient):
    import uuid

    res = await client.get(f"/api/v1/sessions/{uuid.uuid4()}")
    assert res.status_code == 404


async def test_sync_sets_via_http(client: AsyncClient):
    import uuid

    create_res = await client.post("/api/v1/sessions", json={})
    session_id = create_res.json()["id"]

    payload = {
        "items": [
            {
                "client_idempotency_key": "http-key-1",
                "session_exercise_id": str(uuid.uuid4()),
                "set_order": 0,
                "actual_reps": 5,
                "actual_weight_kg": 50.0,
            }
        ]
    }
    # Unknown session_exercise_id is skipped, not an error — the batch call itself succeeds.
    res = await client.post(f"/api/v1/sessions/{session_id}/sets/sync", json=payload)
    assert res.status_code == 200
    assert res.json()["acked"] == []
