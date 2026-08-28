import uuid

import jwt
from httpx import AsyncClient


async def test_workout_equipment_household_tenant_isolation(client: AsyncClient):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = {"X-Household-ID": home_a}
    headers_b = {"X-Household-ID": home_b}

    res_a = await client.post(
        "/api/v1/equipment",
        json={"name": "Household A Rack", "scope": "household"},
        headers=headers_a,
    )
    assert res_a.status_code == 201
    equipment_a = res_a.json()

    res_b = await client.get("/api/v1/equipment", headers=headers_b)
    assert res_b.status_code == 200
    equipment_b = res_b.json()
    assert not any(e["id"] == equipment_a["id"] for e in equipment_b)

    get_res = await client.get(f"/api/v1/equipment/{equipment_a['id']}", headers=headers_b)
    assert get_res.status_code == 404


async def test_workout_equipment_cross_tenant_idor_header_override_rejected(client: AsyncClient):
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

    response = await client.get("/api/v1/equipment", headers=auth_headers)
    assert response.status_code == 403
    assert "forbidden" in response.json()["detail"].lower()


async def test_workout_equipment_authorized_household_header_override_allowed(client: AsyncClient):
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

    response = await client.get("/api/v1/equipment", headers=auth_headers)
    assert response.status_code == 200


async def test_workout_equipment_user_scope_not_visible_to_other_user_same_household(client: AsyncClient):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    token_a = jwt.encode({"sub": user_a, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")
    token_b = jwt.encode({"sub": user_b, "household_id": home_id, "households": [home_id]}, "secret", algorithm="HS256")

    headers_a = {"Authorization": f"Bearer {token_a}", "X-Household-ID": home_id}
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Household-ID": home_id}

    res_a = await client.post(
        "/api/v1/equipment", json={"name": "User A's Own Band", "scope": "user"}, headers=headers_a
    )
    assert res_a.status_code == 201
    equipment_a = res_a.json()

    res_b = await client.get("/api/v1/equipment", headers=headers_b)
    equipment_b = res_b.json()
    assert not any(e["id"] == equipment_a["id"] for e in equipment_b)
