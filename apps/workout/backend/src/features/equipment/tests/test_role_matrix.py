"""Household role matrix of Workout equipment: household entries are shared configuration, user entries are personal."""

import uuid
from unittest.mock import patch

import pytest
from backend_shared.household import HouseholdRole
from backend_shared.household.testing import mcp_household_context
from fastmcp.exceptions import ToolError
from httpx import AsyncClient
from src.features.equipment import mcp_tools

URL = "/api/v1/equipment"
HOME = uuid.uuid4()


async def _create(client: AsyncClient, headers: dict[str, str], scope: str) -> str:
    response = await client.post(URL, json={"name": f"Rack {scope}", "scope": scope}, headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


async def test_guest_cannot_create_household_equipment(client: AsyncClient, member_headers):
    response = await client.post(
        URL, json={"name": "Rack", "scope": "household"}, headers=member_headers(HOME, role="GUEST")
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


async def test_guest_manages_personal_equipment(client: AsyncClient, member_headers):
    headers = member_headers(HOME, role="GUEST")
    equipment_id = await _create(client, headers, "user")

    updated = await client.patch(f"{URL}/{equipment_id}", json={"name": "Mine"}, headers=headers)
    assert updated.status_code == 200
    assert (await client.delete(f"{URL}/{equipment_id}", headers=headers)).status_code == 204


async def test_guest_cannot_update_or_delete_household_equipment(client: AsyncClient, member_headers):
    equipment_id = await _create(client, member_headers(HOME, role="MEMBER"), "household")
    guest = member_headers(HOME, sub="guest-user", role="GUEST")

    updated = await client.patch(f"{URL}/{equipment_id}", json={"name": "Hijack"}, headers=guest)
    deleted = await client.delete(f"{URL}/{equipment_id}", headers=guest)

    assert updated.status_code == 403
    assert deleted.status_code == 403
    assert updated.json()["detail"]["code"] == "household_role_forbidden"


async def test_member_updates_but_cannot_delete_household_equipment(client: AsyncClient, member_headers):
    headers = member_headers(HOME, role="MEMBER")
    equipment_id = await _create(client, headers, "household")

    assert (await client.patch(f"{URL}/{equipment_id}", json={"name": "Renamed"}, headers=headers)).status_code == 200
    assert (await client.delete(f"{URL}/{equipment_id}", headers=headers)).status_code == 403


@pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
async def test_admin_and_owner_delete_household_equipment(client: AsyncClient, member_headers, role: HouseholdRole):
    headers = member_headers(HOME, role=role)
    equipment_id = await _create(client, headers, "household")

    assert (await client.delete(f"{URL}/{equipment_id}", headers=headers)).status_code == 204


async def test_guest_can_still_manage_personal_plans(client: AsyncClient, member_headers):
    response = await client.post("/api/v1/plans", json={"name": "Mine"}, headers=member_headers(HOME, role="GUEST"))

    assert response.status_code == 201


async def test_guest_unknown_equipment_is_not_found_not_forbidden(client: AsyncClient, member_headers):
    response = await client.delete(f"{URL}/{uuid.uuid4()}", headers=member_headers(HOME, role="GUEST"))

    assert response.status_code == 404


async def test_guest_cannot_create_household_equipment_via_mcp():
    with mcp_household_context(role="GUEST"), pytest.raises(ToolError, match="household_role_forbidden"):
        await mcp_tools.create_equipment(name="Rack", scope="household")


async def test_member_cannot_delete_household_equipment_via_mcp(client: AsyncClient, member_headers, db_session):
    equipment_id = await _create(client, member_headers(HOME, role="OWNER"), "household")

    class _SessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *exc):
            return False

    with (
        patch.object(mcp_tools, "async_session_factory", side_effect=_SessionContext),
        mcp_household_context(household_id=HOME, sub="test-user", role="MEMBER"),
        pytest.raises(ToolError, match="household_role_forbidden"),
    ):
        await mcp_tools.delete_equipment(equipment_id=equipment_id)

    with (
        patch.object(mcp_tools, "async_session_factory", side_effect=_SessionContext),
        mcp_household_context(household_id=HOME, sub="test-user", role="ADMIN"),
    ):
        assert "Success: Deleted" in await mcp_tools.delete_equipment(equipment_id=equipment_id)
