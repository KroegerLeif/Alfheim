"""Assignee checks against the household member list (#583) and lazy reconciliation (#581)."""

import uuid
from datetime import date
from unittest.mock import patch

import pytest
from backend_shared.household import HouseholdRole, MembershipServiceError, derive_user_id, get_member_directory
from backend_shared.household.testing import StaticMembershipLookup, mcp_household_context, mcp_membership
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management import mcp_tools
from src.features.chore_management.models import ChoreInstance, ChoreTemplate
from src.main import app
from tests.conftest import TEST_HOUSEHOLD_ID

NUMERIC_SUB = "309876543210987654"  # Zitadel-style subject that is not a UUID


class BrokenDirectory:
    """Member directory whose household app is down."""

    async def list_members(self, household_id: uuid.UUID):
        raise MembershipServiceError("membership API unreachable: ConnectError")


async def _today_instance(client: AsyncClient, name: str) -> dict:
    created = await client.post("/api/v1/chores/templates", json={"name": name, "points": 5})
    assert created.status_code == 201
    today = (await client.get("/api/v1/chores/today")).json()
    return next(i for i in today if i["template_id"] == created.json()["id"])


async def _assign(client: AsyncClient, instance_id: str, user_id: uuid.UUID):
    return await client.post(f"/api/v1/chores/instances/{instance_id}/assign", json={"assigned_to": str(user_id)})


# --- #583: assignee validation by derived user id -----------------------------------------


@pytest.mark.asyncio
async def test_member_with_a_non_uuid_subject_can_be_assigned(client: AsyncClient, membership: StaticMembershipLookup):
    membership.set(TEST_HOUSEHOLD_ID, NUMERIC_SUB, "MEMBER")
    instance = await _today_instance(client, "Vacuum")

    response = await _assign(client, instance["id"], derive_user_id(NUMERIC_SUB))

    assert response.status_code == 200
    assert response.json()["assigned_to"] == str(derive_user_id(NUMERIC_SUB))


@pytest.mark.asyncio
async def test_a_guest_cannot_be_assigned(client: AsyncClient, membership: StaticMembershipLookup):
    membership.set(TEST_HOUSEHOLD_ID, NUMERIC_SUB, "GUEST")
    instance = await _today_instance(client, "Dust")

    response = await _assign(client, instance["id"], derive_user_id(NUMERIC_SUB))

    assert response.status_code == 422
    assert "guest" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_assignment_is_503_when_members_cannot_be_listed(client: AsyncClient):
    instance = await _today_instance(client, "Mop")
    app.dependency_overrides[get_member_directory] = BrokenDirectory

    response = await _assign(client, instance["id"], uuid.uuid4())

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"


# --- #581: lazy reconciliation ------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("new_role", [None, "GUEST"])
async def test_open_chore_is_released_when_the_assignee_leaves_or_becomes_a_guest(
    client: AsyncClient, membership: StaticMembershipLookup, new_role
):
    membership.set(TEST_HOUSEHOLD_ID, NUMERIC_SUB, "MEMBER")
    instance = await _today_instance(client, f"Windows {new_role}")
    assert (await _assign(client, instance["id"], derive_user_id(NUMERIC_SUB))).status_code == 200

    membership.set(TEST_HOUSEHOLD_ID, NUMERIC_SUB, new_role)
    today = (await client.get("/api/v1/chores/today")).json()

    assert next(i for i in today if i["id"] == instance["id"])["assigned_to"] is None


@pytest.mark.asyncio
async def test_completed_chore_keeps_a_former_member_as_history(
    client: AsyncClient, membership: StaticMembershipLookup, db_session: AsyncSession
):
    former = derive_user_id(NUMERIC_SUB)
    instance = await _today_instance(client, "Laundry")
    stored = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.id == uuid.UUID(instance["id"])))).one()
    stored.assigned_to = former
    stored.status = "completed"
    db_session.add(stored)
    await db_session.commit()

    today = (await client.get("/api/v1/chores/today")).json()

    assert next(i for i in today if i["id"] == instance["id"])["assigned_to"] == str(former)


@pytest.mark.asyncio
async def test_current_members_keep_their_open_chores(client: AsyncClient, membership: StaticMembershipLookup):
    membership.set(TEST_HOUSEHOLD_ID, NUMERIC_SUB, "ADMIN")
    instance = await _today_instance(client, "Bins")
    await _assign(client, instance["id"], derive_user_id(NUMERIC_SUB))

    today = (await client.get("/api/v1/chores/today")).json()

    assert next(i for i in today if i["id"] == instance["id"])["assigned_to"] == str(derive_user_id(NUMERIC_SUB))


@pytest.mark.asyncio
async def test_chores_are_listed_unchanged_when_members_cannot_be_listed(
    client: AsyncClient, membership: StaticMembershipLookup, db_session: AsyncSession
):
    instance = await _today_instance(client, "Plants")
    stored = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.id == uuid.UUID(instance["id"])))).one()
    stored.assigned_to = uuid.uuid4()  # not a member
    db_session.add(stored)
    await db_session.commit()
    app.dependency_overrides[get_member_directory] = BrokenDirectory

    response = await client.get("/api/v1/chores/today")

    assert response.status_code == 200
    assert next(i for i in response.json() if i["id"] == instance["id"])["assigned_to"] == str(stored.assigned_to)


@pytest.mark.asyncio
async def test_an_empty_member_list_releases_nothing(db_session: AsyncSession):
    from src.features.chore_management.services.instance_service import InstanceService

    inst = ChoreInstance(
        template_id=uuid.uuid4(), home_id=uuid.uuid4(), due_date=date.today(), assigned_to=uuid.uuid4()
    )

    await InstanceService.reconcile_assignees(db_session, [inst], [])

    assert inst.assigned_to is not None


# --- MCP ----------------------------------------------------------------------------------


@pytest.fixture
def mcp_session(db_session: AsyncSession):
    class TestSessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("src.features.chore_management.mcp_tools.async_session_factory", side_effect=TestSessionContext):
        yield


@pytest.mark.asyncio
@pytest.mark.parametrize(("role", "expected"), [("MEMBER", "Success"), ("GUEST", "cannot be assigned chores")])
async def test_mcp_assign_matches_non_uuid_subjects_and_rejects_guests(
    db_session: AsyncSession, mcp_session, role: HouseholdRole, expected: str
):
    household = uuid.uuid4()
    template = ChoreTemplate(name=f"Feed cat {role}", home_id=household, points=5)
    db_session.add(template)
    await db_session.commit()

    with mcp_household_context(household_id=household), mcp_membership({(household, NUMERIC_SUB): role}):
        await mcp_tools.get_daily_chores_overview()
        instance = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.template_id == template.id))).one()
        result = await mcp_tools.assign_chore(str(instance.id), NUMERIC_SUB)

    assert expected in result
