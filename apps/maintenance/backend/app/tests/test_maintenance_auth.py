"""Household authorization of maintenance routes via backend_shared.household (membership owned by core/household)."""

import uuid

import pytest
from app.features.devices.models import Device
from app.main import app
from app.tests.conftest import TEST_HOUSEHOLD_ID, TEST_USER_SUB, auth_headers
from backend_shared.household import MembershipServiceError, get_membership_lookup
from backend_shared.household.testing import StaticMembershipLookup, make_test_token
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

OTHER_HOUSEHOLD_ID = uuid.UUID("9d0c7a1e-2b3f-4c5d-8e9f-0a1b2c3d4e5f")

DEVICE_PAYLOAD = {
    "name": "Dyson Purifier",
    "model": "TP02",
    "serial": "SN-12345",
    "category": "Appliances",
    "location": "Living Room",
    "status": "active",
    "service_interval_months": 6,
    "notes": "Change filter",
    "steps": [{"title": "Clean Mesh", "description": "Vacuum filter mesh", "recurrence": 1}],
}


@pytest.mark.asyncio
async def test_maintenance_health(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_device_creation_and_retrieval(client: AsyncClient, membership: StaticMembershipLookup):
    response = await client.post("/api/v1/devices", json=DEVICE_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Dyson Purifier"
    assert data["household_id"] == str(TEST_HOUSEHOLD_ID)
    assert len(data["steps"]) == 1

    get_res = await client.get("/api/v1/devices")
    assert get_res.status_code == 200
    assert [d["id"] for d in get_res.json()] == [data["id"]]
    assert (TEST_HOUSEHOLD_ID, TEST_USER_SUB) in membership.calls


@pytest.mark.asyncio
async def test_legacy_payload_household_id_is_ignored(client: AsyncClient):
    """A legacy integer household_id in the payload never selects the household."""
    response = await client.post("/api/v1/devices", json={**DEVICE_PAYLOAD, "household_id": 99999})
    assert response.status_code == 201
    assert response.json()["household_id"] == str(TEST_HOUSEHOLD_ID)


@pytest.mark.asyncio
async def test_cross_tenant_header_is_forbidden(anon_client: AsyncClient):
    """A user selecting a household they are not a member of is rejected by the membership check."""
    response = await anon_client.get("/api/v1/devices", headers=auth_headers(OTHER_HOUSEHOLD_ID))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_cross_tenant_device_is_invisible(
    anon_client: AsyncClient, db_session: AsyncSession, membership: StaticMembershipLookup
):
    """A member of another household cannot read this household's devices."""
    device = Device(
        name="Private Boiler",
        model="B",
        serial="S",
        category="Heating",
        location="Cellar",
        status="active",
        household_id=TEST_HOUSEHOLD_ID,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    membership.set(OTHER_HOUSEHOLD_ID, "neighbour", "OWNER")
    neighbour = auth_headers(OTHER_HOUSEHOLD_ID, sub="neighbour")

    assert (await anon_client.get(f"/api/v1/devices/{device.id}", headers=neighbour)).status_code == 404
    assert (await anon_client.get("/api/v1/devices", headers=neighbour)).json() == []
    summary = (await anon_client.get("/api/v1/maintenance/summary", headers=neighbour)).json()
    assert summary[0]["household_id"] == str(OTHER_HOUSEHOLD_ID)
    assert summary[0]["total_devices"] == 0


@pytest.mark.asyncio
async def test_missing_household_header_is_rejected(anon_client: AsyncClient):
    headers = {"Authorization": f"Bearer {make_test_token(TEST_USER_SUB)}"}
    response = await anon_client.get("/api/v1/devices", headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


@pytest.mark.asyncio
async def test_legacy_integer_household_header_is_rejected(anon_client: AsyncClient):
    response = await anon_client.get("/api/v1/devices", headers=auth_headers("2"))
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_invalid"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/devices"),
        ("get", "/api/v1/households"),
        ("get", "/api/v1/history"),
        ("get", "/api/v1/maintenance/summary"),
        ("post", "/api/v1/maintenance/wizard"),
        ("post", "/api/v1/submit"),
    ],
)
async def test_routes_require_authentication(anon_client: AsyncClient, method: str, path: str):
    response = await anon_client.request(method, path, headers={"X-Household-ID": str(TEST_HOUSEHOLD_ID)})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_membership_service_outage_fails_closed(client: AsyncClient):
    async def _unavailable(household_id: uuid.UUID, user_sub: str):
        raise MembershipServiceError("household app down")

    app.dependency_overrides[get_membership_lookup] = lambda: _unavailable

    response = await client.get("/api/v1/devices")

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"


@pytest.mark.asyncio
async def test_mcp_endpoint_requires_household_header(anon_client: AsyncClient):
    headers = {"Authorization": f"Bearer {make_test_token(TEST_USER_SUB)}"}
    response = await anon_client.post("/mcp/", headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"
