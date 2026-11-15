"""Device and step editing (#505), first due dates of new steps (#621) and step comments (#620)."""

import datetime
import uuid

import pytest
from app.features.devices.service import first_due_date
from app.features.tasks.service import add_months
from app.tests.conftest import TEST_USER_SUB, auth_headers
from app.tests.test_maintenance_auth import DEVICE_PAYLOAD
from backend_shared.household.testing import StaticMembershipLookup
from httpx import AsyncClient

TODAY = datetime.date.today()


async def _create_device(client: AsyncClient, **overrides) -> dict:
    response = await client.post("/api/v1/devices", json={**DEVICE_PAYLOAD, **overrides})
    assert response.status_code == 201
    return response.json()


def _foreign_headers(membership: StaticMembershipLookup) -> dict[str, str]:
    """Headers of the same user acting in a second household they also belong to."""
    other = uuid.uuid4()
    membership.set(other, TEST_USER_SUB, "OWNER")
    return auth_headers(other)


# --- #621: first due dates ---------------------------------------------------------------


def test_first_due_date_is_one_interval_from_the_given_day():
    assert first_due_date(3, datetime.date(2026, 11, 30)) == "2027-02-28"
    assert first_due_date(1) == add_months(TODAY, 1).isoformat()


@pytest.mark.asyncio
async def test_steps_created_with_a_device_get_a_first_due_date(client: AsyncClient):
    device = await _create_device(
        client,
        steps=[
            {"title": "Filter", "recurrence": 3},
            {"title": "Descale", "recurrence": 12},
        ],
    )

    due = {step["title"]: step["supply_needed_date"] for step in device["steps"]}
    assert due == {"Filter": add_months(TODAY, 3).isoformat(), "Descale": add_months(TODAY, 12).isoformat()}
    assert all(step["last_completed"] is None for step in device["steps"])


# --- #505: device editing ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_device_changes_only_the_sent_fields(client: AsyncClient):
    device = await _create_device(client)

    response = await client.patch(f"/api/v1/devices/{device['id']}", json={"serial": "SN-99", "notes": None})

    assert response.status_code == 200
    body = response.json()
    assert body["serial"] == "SN-99"
    assert body["notes"] is None
    assert body["name"] == device["name"]
    assert len(body["steps"]) == len(device["steps"])


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"name": None}, {"name": ""}, {"service_interval_months": 0}])
async def test_patch_device_rejects_invalid_values(client: AsyncClient, payload: dict):
    device = await _create_device(client)

    response = await client.patch(f"/api/v1/devices/{device['id']}", json=payload)

    assert response.status_code == 422
    assert (await client.get(f"/api/v1/devices/{device['id']}")).json()["name"] == device["name"]


@pytest.mark.asyncio
async def test_delete_device_removes_it_with_steps_and_history(client: AsyncClient):
    device = await _create_device(client)
    step_id = device["steps"][0]["id"]
    submitted = await client.post(
        "/api/v1/submit", json={"device_id": device["id"], "performer": "Alice", "completed_step_ids": [step_id]}
    )
    assert submitted.status_code in (200, 201)

    response = await client.delete(f"/api/v1/devices/{device['id']}")

    assert response.status_code == 204
    assert (await client.get(f"/api/v1/devices/{device['id']}")).status_code == 404
    assert (await client.post(f"/api/v1/tasks/{step_id}/state", json={"comment": "x"})).status_code == 404
    history = (await client.get("/api/v1/history")).json()
    assert all(event["device_id"] != device["id"] for event in history)


@pytest.mark.asyncio
async def test_device_edits_are_tenant_isolated(client: AsyncClient, membership: StaticMembershipLookup):
    device = await _create_device(client)
    foreign = _foreign_headers(membership)

    assert (
        await client.patch(f"/api/v1/devices/{device['id']}", json={"name": "Hijacked"}, headers=foreign)
    ).status_code == 404
    assert (await client.delete(f"/api/v1/devices/{device['id']}", headers=foreign)).status_code == 404
    assert (
        await client.post(
            f"/api/v1/devices/{device['id']}/steps", json={"title": "X", "recurrence": 1}, headers=foreign
        )
    ).status_code == 404
    step_id = device["steps"][0]["id"]
    assert (
        await client.patch(f"/api/v1/devices/{device['id']}/steps/{step_id}", json={"title": "X"}, headers=foreign)
    ).status_code == 404
    assert (await client.delete(f"/api/v1/devices/{device['id']}/steps/{step_id}", headers=foreign)).status_code == 404

    unchanged = (await client.get(f"/api/v1/devices/{device['id']}")).json()
    assert unchanged["name"] == device["name"]
    assert len(unchanged["steps"]) == 1


@pytest.mark.asyncio
async def test_unknown_device_is_404(client: AsyncClient):
    assert (await client.patch("/api/v1/devices/999999", json={"name": "X"})).status_code == 404
    assert (await client.delete("/api/v1/devices/999999")).status_code == 404


# --- #505: step editing ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_step_seeds_its_due_date(client: AsyncClient):
    device = await _create_device(client)

    response = await client.post(
        f"/api/v1/devices/{device['id']}/steps",
        json={"title": "Check seals", "description": "Look for cracks", "recurrence": 6, "supply_item": "Seal kit"},
    )

    assert response.status_code == 201
    step = response.json()
    assert step["device_id"] == device["id"]
    assert step["supply_needed_date"] == add_months(TODAY, 6).isoformat()
    titles = [s["title"] for s in (await client.get(f"/api/v1/devices/{device['id']}")).json()["steps"]]
    assert "Check seals" in titles


@pytest.mark.asyncio
async def test_patch_step_edits_fields_and_moves_the_due_date_with_the_interval(client: AsyncClient):
    device = await _create_device(client)
    step = device["steps"][0]

    renamed = await client.patch(
        f"/api/v1/devices/{device['id']}/steps/{step['id']}", json={"title": "Clean mesh", "supply_item": None}
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Clean mesh"
    assert renamed.json()["supply_needed_date"] == step["supply_needed_date"]

    reinterval = await client.patch(f"/api/v1/devices/{device['id']}/steps/{step['id']}", json={"recurrence": 4})
    assert reinterval.json()["recurrence"] == 4
    assert reinterval.json()["supply_needed_date"] == add_months(TODAY, 4).isoformat()


@pytest.mark.asyncio
async def test_new_interval_counts_from_the_last_completion(client: AsyncClient):
    device = await _create_device(client)
    step_id = device["steps"][0]["id"]
    await client.post(
        "/api/v1/submit", json={"device_id": device["id"], "performer": "Alice", "completed_step_ids": [step_id]}
    )

    response = await client.patch(f"/api/v1/devices/{device['id']}/steps/{step_id}", json={"recurrence": 2})

    assert response.json()["last_completed"] == TODAY.isoformat()
    assert response.json()["supply_needed_date"] == add_months(TODAY, 2).isoformat()


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"title": None}, {"recurrence": None}, {"recurrence": 0}, {"title": ""}])
async def test_patch_step_rejects_invalid_values(client: AsyncClient, payload: dict):
    device = await _create_device(client)

    response = await client.patch(f"/api/v1/devices/{device['id']}/steps/{device['steps'][0]['id']}", json=payload)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_delete_step(client: AsyncClient):
    device = await _create_device(client)
    step_id = device["steps"][0]["id"]

    assert (await client.delete(f"/api/v1/devices/{device['id']}/steps/{step_id}")).status_code == 204
    assert (await client.get(f"/api/v1/devices/{device['id']}")).json()["steps"] == []
    assert (await client.delete(f"/api/v1/devices/{device['id']}/steps/{step_id}")).status_code == 404


@pytest.mark.asyncio
async def test_step_of_another_device_is_404(client: AsyncClient):
    first = await _create_device(client)
    second = await _create_device(client)

    response = await client.patch(
        f"/api/v1/devices/{second['id']}/steps/{first['steps'][0]['id']}", json={"title": "X"}
    )

    assert response.status_code == 404


# --- #620: comments ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_comment_is_stored_apart_from_the_procedure_and_can_be_cleared(client: AsyncClient):
    device = await _create_device(client)
    step = device["steps"][0]
    assert step["comment"] is None

    saved = await client.post(f"/api/v1/tasks/{step['id']}/state", json={"comment": "  Mesh was dusty  "})
    assert saved.json()["comment"] == "Mesh was dusty"
    assert saved.json()["description"] == "Vacuum filter mesh"

    untouched = await client.post(f"/api/v1/tasks/{step['id']}/state", json={"supply_item": "Mesh"})
    assert untouched.json()["comment"] == "Mesh was dusty"

    cleared = await client.post(f"/api/v1/tasks/{step['id']}/state", json={"comment": None})
    assert cleared.status_code == 200
    assert cleared.json()["comment"] is None
    assert cleared.json()["description"] == "Vacuum filter mesh"

    blank = await client.post(f"/api/v1/tasks/{step['id']}/state", json={"comment": "x"})
    assert blank.json()["comment"] == "x"
    assert (await client.post(f"/api/v1/tasks/{step['id']}/state", json={"comment": "   "})).json()["comment"] is None


@pytest.mark.asyncio
async def test_wizard_comment_does_not_replace_the_procedure(client: AsyncClient):
    device = await _create_device(client)
    step_id = device["steps"][0]["id"]

    response = await client.post(
        "/api/v1/maintenance/wizard",
        json={
            "device_id": device["id"],
            "performer": "Alice",
            "completed_steps": [{"step_id": step_id, "comment": "Replaced the mesh"}],
        },
    )

    assert response.status_code in (200, 201)
    stored = next(
        s for s in (await client.get(f"/api/v1/devices/{device['id']}")).json()["steps"] if s["id"] == step_id
    )
    assert stored["comment"] == "Replaced the mesh"
    assert stored["description"] == "Vacuum filter mesh"
