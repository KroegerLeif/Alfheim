import uuid

from httpx import AsyncClient


async def test_workout_equipment_household_tenant_isolation(client: AsyncClient, member_headers):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = member_headers(home_a)
    headers_b = member_headers(home_b)

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


async def test_workout_equipment_cross_tenant_idor_header_override_rejected(client: AsyncClient, member_headers):
    home_authorized = uuid.uuid4()
    headers = member_headers(home_authorized)
    headers["X-Household-ID"] = str(uuid.uuid4())  # a household the caller is not a member of

    response = await client.get("/api/v1/equipment", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


async def test_workout_equipment_authorized_household_header_override_allowed(client: AsyncClient, member_headers):
    home_a = uuid.uuid4()
    home_b = uuid.uuid4()
    member_headers(home_a)

    response = await client.get("/api/v1/equipment", headers=member_headers(home_b))
    assert response.status_code == 200


async def test_workout_equipment_user_scope_not_visible_to_other_user_same_household(
    client: AsyncClient, member_headers
):
    home_id = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    headers_a = member_headers(home_id, sub=user_a)
    headers_b = member_headers(home_id, sub=user_b)

    res_a = await client.post(
        "/api/v1/equipment", json={"name": "User A's Own Band", "scope": "user"}, headers=headers_a
    )
    assert res_a.status_code == 201
    equipment_a = res_a.json()

    res_b = await client.get("/api/v1/equipment", headers=headers_b)
    equipment_b = res_b.json()
    assert not any(e["id"] == equipment_a["id"] for e in equipment_b)
