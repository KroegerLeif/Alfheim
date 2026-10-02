"""Integration tests for chore management router endpoints and edge cases."""

import uuid
from datetime import date, timedelta

import pytest
from backend_shared.household import derive_user_id
from backend_shared.household.testing import DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB
from httpx import AsyncClient

TEST_USER_ID = derive_user_id(DEFAULT_TEST_SUB)
OTHER_SUB = "other-member"
OTHER_USER_ID = derive_user_id(OTHER_SUB)


@pytest.mark.asyncio
async def test_get_chore_template_not_found(client: AsyncClient, auth_headers):
    """Verify that requesting a nonexistent chore template returns 404 Not Found."""
    fake_id = uuid.uuid4()
    headers = auth_headers()
    response = await client.get(f"/api/v1/chores/templates/{fake_id}", headers=headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_and_delete_chore_template_router(client: AsyncClient, auth_headers):
    """Verify partial updates, validation errors, and deletion via template endpoints."""
    headers = auth_headers()

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
async def test_today_chores_and_instance_lifecycle_router(client: AsyncClient, auth_headers, membership):
    """Verify chore instance lifecycle through router endpoints."""
    headers = auth_headers()
    # The REST assign endpoint only carries a UUID, so membership is checked by treating it as
    # a candidate subject; this works cleanly when the assignee's subject is itself a UUID (the
    # common case in this deployment).
    member_sub = str(uuid.uuid4())
    member_user_id = derive_user_id(member_sub)
    membership.set(DEFAULT_TEST_HOUSEHOLD_ID, member_sub, "MEMBER")

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

    # Assign instance to an actual household member
    assigned_user = str(member_user_id)
    res_assign = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": assigned_user},
        headers=headers,
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["assigned_to"] == assigned_user

    # Assigning to an id that isn't a member of the household is rejected (#513).
    res_assign_non_member = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": str(uuid.uuid4())},
        headers=headers,
    )
    assert res_assign_non_member.status_code == 404

    # Assign nonexistent instance -> 400
    res_assign_missing = await client.post(
        f"/api/v1/chores/instances/{uuid.uuid4()}/assign",
        json={"assigned_to": assigned_user},
        headers=headers,
    )
    assert res_assign_missing.status_code == 400

    # Complete instance: a client-supplied completed_by is ignored, the authenticated user is recorded
    spoofed_id = str(uuid.uuid4())
    res_complete = await client.post(
        f"/api/v1/chores/instances/{instance_id}/complete",
        json={"completed_by": spoofed_id, "completed_by_name": "Test Completer"},
        headers=headers,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["status"] == "completed"
    assert res_complete.json()["completed_by"] == str(TEST_USER_ID)
    assert res_complete.json()["completed_by"] != spoofed_id

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
async def test_complete_chore_without_payload_and_summary_router(client: AsyncClient, auth_headers):
    """Verify chore completion without body and integrations summary dashboard retrieval."""
    headers = auth_headers()

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


@pytest.mark.asyncio
async def test_claim_chore_instance_is_always_the_caller(client: AsyncClient, auth_headers):
    """The /claim endpoint self-assigns to the authenticated caller and toggles on repeat calls."""
    headers = auth_headers()

    res_tmpl = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Feed Cat", "points": 5},
        headers=headers,
    )
    assert res_tmpl.status_code == 201

    res_today = await client.get("/api/v1/chores/today", headers=headers)
    instance_id = res_today.json()[0]["id"]
    assert res_today.json()[0]["assigned_to"] is None

    # Claim: assignee comes from the authenticated caller, never a request body.
    res_claim = await client.post(f"/api/v1/chores/instances/{instance_id}/claim", headers=headers)
    assert res_claim.status_code == 200
    assert res_claim.json()["assigned_to"] == str(TEST_USER_ID)

    # Claiming again releases the caller's own claim (toggle).
    res_release = await client.post(f"/api/v1/chores/instances/{instance_id}/claim", headers=headers)
    assert res_release.status_code == 200
    assert res_release.json()["assigned_to"] is None


@pytest.mark.asyncio
async def test_claim_chore_instance_rejects_claiming_someone_elses_chore(client: AsyncClient, auth_headers, membership):
    """A member cannot claim (or release) a chore another member already holds."""
    membership.set(DEFAULT_TEST_HOUSEHOLD_ID, OTHER_SUB, "MEMBER")
    headers = auth_headers()
    other_headers = auth_headers(sub=OTHER_SUB)

    res_tmpl = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Walk Dog", "points": 5},
        headers=headers,
    )
    assert res_tmpl.status_code == 201

    res_today = await client.get("/api/v1/chores/today", headers=headers)
    instance_id = res_today.json()[0]["id"]

    # The default caller claims it first.
    res_claim = await client.post(f"/api/v1/chores/instances/{instance_id}/claim", headers=headers)
    assert res_claim.status_code == 200
    assert res_claim.json()["assigned_to"] == str(TEST_USER_ID)

    # A different household member cannot claim (or release) it via the self-service endpoint.
    res_other_claim = await client.post(f"/api/v1/chores/instances/{instance_id}/claim", headers=other_headers)
    assert res_other_claim.status_code == 400


@pytest.mark.asyncio
async def test_assign_chore_instance_permission_checks(client: AsyncClient, auth_headers, membership):
    """A non-elevated member may only assign to themself; OWNER/ADMIN may assign to anyone."""
    membership.set(DEFAULT_TEST_HOUSEHOLD_ID, OTHER_SUB, "MEMBER")
    headers = auth_headers()
    member_headers = auth_headers(sub=OTHER_SUB)

    res_tmpl = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Take Out Trash", "points": 5},
        headers=headers,
    )
    assert res_tmpl.status_code == 201

    res_today = await client.get("/api/v1/chores/today", headers=member_headers)
    instance_id = res_today.json()[0]["id"]

    # A plain MEMBER may self-assign.
    res_self = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": str(OTHER_USER_ID)},
        headers=member_headers,
    )
    assert res_self.status_code == 200
    assert res_self.json()["assigned_to"] == str(OTHER_USER_ID)

    # A plain MEMBER may not assign it to someone else.
    res_forbidden = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": str(TEST_USER_ID)},
        headers=member_headers,
    )
    assert res_forbidden.status_code == 403

    # The household OWNER (default test caller) may assign it to anyone.
    res_owner_assign = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": str(TEST_USER_ID)},
        headers=headers,
    )
    assert res_owner_assign.status_code == 200
    assert res_owner_assign.json()["assigned_to"] == str(TEST_USER_ID)

    # Anyone may still release (unclaim) a chore, regardless of who holds it.
    res_release = await client.post(
        f"/api/v1/chores/instances/{instance_id}/assign",
        json={"assigned_to": None},
        headers=member_headers,
    )
    assert res_release.status_code == 200
    assert res_release.json()["assigned_to"] is None
