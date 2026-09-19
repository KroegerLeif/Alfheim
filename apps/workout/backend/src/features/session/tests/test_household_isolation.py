import uuid

from httpx import AsyncClient


async def test_workout_sessions_household_tenant_isolation(client: AsyncClient, member_headers):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = member_headers(home_a)
    headers_b = member_headers(home_b)

    res_a = await client.post("/api/v1/sessions", json={}, headers=headers_a)
    assert res_a.status_code == 201
    session_a = res_a.json()

    res_b = await client.get("/api/v1/sessions", headers=headers_b)
    assert res_b.status_code == 200
    assert not any(s["id"] == session_a["id"] for s in res_b.json())

    get_res = await client.get(f"/api/v1/sessions/{session_a['id']}", headers=headers_b)
    assert get_res.status_code == 404


async def test_workout_sessions_cross_tenant_idor_header_override_rejected(client: AsyncClient, member_headers):
    home_authorized = uuid.uuid4()
    headers = member_headers(home_authorized)
    headers["X-Household-ID"] = str(uuid.uuid4())  # a household the caller is not a member of

    response = await client.get("/api/v1/sessions", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


async def test_workout_sessions_not_visible_to_other_user_same_household(client: AsyncClient, member_headers):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    headers_a = member_headers(home_id, sub=user_a)
    headers_b = member_headers(home_id, sub=user_b)

    res_a = await client.post("/api/v1/sessions", json={}, headers=headers_a)
    session_a = res_a.json()

    # Sessions are strictly per-user (unlike plans, they are never shareable).
    get_res = await client.get(f"/api/v1/sessions/{session_a['id']}", headers=headers_b)
    assert get_res.status_code == 404

    list_res = await client.get("/api/v1/sessions", headers=headers_b)
    assert not any(s["id"] == session_a["id"] for s in list_res.json())


async def test_workout_sessions_sync_cross_household_rejected(client: AsyncClient, member_headers):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())
    headers_a = member_headers(home_a)
    headers_b = member_headers(home_b)

    res_a = await client.post("/api/v1/sessions", json={}, headers=headers_a)
    session_id = res_a.json()["id"]

    payload = {
        "items": [
            {
                "client_idempotency_key": "cross-tenant-key",
                "session_exercise_id": str(uuid.uuid4()),
                "set_order": 0,
            }
        ]
    }
    res_b = await client.post(f"/api/v1/sessions/{session_id}/sets/sync", json=payload, headers=headers_b)
    assert res_b.status_code == 400
