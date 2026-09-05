"""Integration tests for chore management router endpoints and edge cases."""

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_chore_template_not_found(client: AsyncClient):
    """Verify that requesting a nonexistent chore template returns 404 Not Found."""
    fake_id = uuid.uuid4()
    headers = {"X-Household-ID": str(uuid.uuid4())}
    response = await client.get(f"/api/v1/chores/templates/{fake_id}", headers=headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_and_delete_chore_template_router(client: AsyncClient):
    """Verify partial updates, validation errors, and deletion via template endpoints."""
    household_id = str(uuid.uuid4())
    headers = {"X-Household-ID": household_id}

    # Create two templates
    res1 = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Dust Blinds", "description": "Living room", "points": 10},
        headers=headers,
    )
    assert res1.status_code == 201
    template1_id = res1.json()["id"]

    # Verify fetching existing template details
    res_get = await client.get(f"/api/v1/chores/templates/{template1_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == template1_id

    res2 = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Water Plants", "description": "Balcony", "points": 5},
        headers=headers,
    )
    assert res2.status_code == 201
    template2_id = res2.json()["id"]

    # 1. Update template 1 with non-clashing data
    res_update = await client.patch(
        f"/api/v1/chores/templates/{template1_id}",
        json={"name": "Dust Venetian Blinds", "points": 15},
        headers=headers,
    )
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "Dust Venetian Blinds"
    assert res_update.json()["points"] == 15

    # 2. Update template 1 with name clashing with template 2 -> 400
    res_clash = await client.patch(
        f"/api/v1/chores/templates/{template1_id}",
        json={"name": "Water Plants"},
        headers=headers,
    )
    assert res_clash.status_code == 400

    # 3. Update non-existent template -> 400 (ChoreTemplateNotFoundError caught by ValueError handler)
    res_not_found = await client.patch(
        f"/api/v1/chores/templates/{uuid.uuid4()}",
        json={"name": "New Name"},
        headers=headers,
    )
    assert res_not_found.status_code == 400

    # 4. Delete template 2
    res_del = await client.delete(f"/api/v1/chores/templates/{template2_id}", headers=headers)
    assert res_del.status_code == 204

    # 5. Delete non-existent template
    res_del_missing = await client.delete(f"/api/v1/chores/templates/{uuid.uuid4()}", headers=headers)
    assert res_del_missing.status_code == 400


@pytest.mark.asyncio
async def test_today_chores_and_instance_lifecycle_router(client: AsyncClient):
    """Verify chore instance lifecycle through router endpoints."""
    household_id = str(uuid.uuid4())
    headers = {"X-Household-ID": household_id}

    # Create a template
    res = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Clean Oven", "description": "Deep clean", "points": 30},
        headers=headers,
    )
    assert res.status_code == 201

    # Query today's chores with explicit due_date
    custom_date = (date.today() + timedelta(days=2)).isoformat()
    res_today = await client.get(f"/api/v1/chores/today?due_date={custom_date}", headers=headers)
    assert res_today.status_code == 200
    instances = res_today.json()
    assert len(instances) >= 1
    instance_id = instances[0]["id"]

    # Assign instance to user
    assigned_user = str(uuid.uuid4())
    res_assign = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": assigned_user},
        headers=headers,
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["assigned_to"] == assigned_user

    # Assign nonexistent instance -> 400
    res_assign_missing = await client.post(
        f"/api/v1/chores/instances/{uuid.uuid4()}/assign",
        json={"assigned_to": assigned_user},
        headers=headers,
    )
    assert res_assign_missing.status_code == 400

    # Complete instance with custom payload
    completer_id = str(uuid.uuid4())
    res_complete = await client.post(
        f"/api/v1/chores/instances/{instance_id}/complete",
        json={"completed_by": completer_id, "completed_by_name": "Test Completer"},
        headers=headers,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["status"] == "completed"
    assert res_complete.json()["completed_by"] == completer_id

    # Attempt re-completing already completed chore -> 400
    res_recomplete = await client.post(
        f"/api/v1/chores/instances/{instance_id}/complete",
        json={},
        headers=headers,
    )
    assert res_recomplete.status_code == 400

    # Attempt re-assigning completed chore -> 400
    res_reassign = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": assigned_user},
        headers=headers,
    )
    assert res_reassign.status_code == 400


@pytest.mark.asyncio
async def test_complete_chore_without_payload_and_summary_router(client: AsyncClient):
    """Verify chore completion without body and integrations summary dashboard retrieval."""
    household_id = str(uuid.uuid4())
    headers = {"X-Household-ID": household_id}

    res_tmpl = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Mop Floor", "description": "Hallway", "points": 12},
        headers=headers,
    )
    assert res_tmpl.status_code == 201

    res_today = await client.get("/api/v1/chores/today", headers=headers)
    assert res_today.status_code == 200
    instance = res_today.json()[0]

    # Complete without payload
    res_complete = await client.post(
        f"/api/v1/chores/instances/{instance['id']}/complete",
        headers=headers,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["status"] == "completed"

    # Retrieve integration summary
    res_summary = await client.get("/api/v1/chores/integrations/summary", headers=headers)
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert summary["today_completed_count"] >= 1
    assert summary["today_pending_count"] == 0
    assert summary["completion_rate"] == 100.0
