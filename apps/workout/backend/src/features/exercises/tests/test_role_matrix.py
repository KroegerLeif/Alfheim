"""Household role matrix of Workout exercises: household entries are shared configuration, user entries are personal."""

import uuid

import pytest
from backend_shared.household import HouseholdRole
from backend_shared.household.testing import mcp_household_context
from fastmcp.exceptions import ToolError
from httpx import AsyncClient
from src.features.exercises import mcp_tools

URL = "/api/v1/exercises"
HOME = uuid.uuid4()


async def _create(client: AsyncClient, headers: dict[str, str], scope: str) -> str:
    payload = {"name": f"Row {scope}", "primary_muscle": "back", "scope": scope}
    response = await client.post(URL, json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


async def test_guest_cannot_create_household_exercise(client: AsyncClient, member_headers):
    payload = {"name": "Row", "primary_muscle": "back", "scope": "household"}

    response = await client.post(URL, json=payload, headers=member_headers(HOME, role="GUEST"))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


async def test_guest_manages_personal_exercise_favorites_and_preferences(client: AsyncClient, member_headers):
    headers = member_headers(HOME, role="GUEST")
    exercise_id = await _create(client, headers, "user")

    assert (await client.post(f"{URL}/{exercise_id}/favorite", headers=headers)).status_code == 201
    assert (await client.delete(f"{URL}/{exercise_id}/favorite", headers=headers)).status_code == 204
    assert (await client.patch(f"{URL}/{exercise_id}", json={"name": "Mine"}, headers=headers)).status_code == 200
    assert (await client.delete(f"{URL}/{exercise_id}", headers=headers)).status_code == 204


async def test_guest_cannot_update_or_delete_household_exercise(client: AsyncClient, member_headers):
    exercise_id = await _create(client, member_headers(HOME, role="MEMBER"), "household")
    guest = member_headers(HOME, sub="guest-user", role="GUEST")

    assert (await client.patch(f"{URL}/{exercise_id}", json={"name": "Hijack"}, headers=guest)).status_code == 403
    assert (await client.delete(f"{URL}/{exercise_id}", headers=guest)).status_code == 403


async def test_member_updates_but_cannot_delete_household_exercise(client: AsyncClient, member_headers):
    headers = member_headers(HOME, role="MEMBER")
    exercise_id = await _create(client, headers, "household")

    assert (await client.patch(f"{URL}/{exercise_id}", json={"name": "Renamed"}, headers=headers)).status_code == 200
    assert (await client.delete(f"{URL}/{exercise_id}", headers=headers)).status_code == 403


@pytest.mark.parametrize("role", ["ADMIN", "OWNER"])
async def test_admin_and_owner_delete_household_exercise(client: AsyncClient, member_headers, role: HouseholdRole):
    headers = member_headers(HOME, role=role)
    exercise_id = await _create(client, headers, "household")

    assert (await client.delete(f"{URL}/{exercise_id}", headers=headers)).status_code == 204


async def test_guest_cannot_create_household_exercise_via_mcp():
    with mcp_household_context(role="GUEST"), pytest.raises(ToolError, match="household_role_forbidden"):
        await mcp_tools.create_exercise(name="Row", primary_muscle="back", scope="household")
