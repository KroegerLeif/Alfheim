import inspect
import uuid
from unittest.mock import patch

import pytest
from backend_shared.household.testing import mcp_household_context, mcp_membership
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management import mcp_tools
from src.features.chore_management.mcp_tools import (
    assign_chore,
    complete_chore_by_name,
    get_daily_chores_overview,
)
from src.features.chore_management.models import ChoreInstance, ChoreTemplate

HOUSEHOLD_A = uuid.UUID("00000000-0000-0000-0000-0000000000a1")
HOUSEHOLD_B = uuid.UUID("00000000-0000-0000-0000-0000000000b1")
USER_A_SUB = "312345678901234567"  # Zitadel-style numeric sub


@pytest.fixture(autouse=True)
def override_mcp_session(db_session: AsyncSession):
    """Patch async_session_factory in mcp_tools to use the test db_session."""

    class TestSessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("src.features.chore_management.mcp_tools.async_session_factory", side_effect=TestSessionContext):
        yield


def test_chores_tools_take_no_household_argument():
    """The LLM can never choose the household (or the acting user) through a tool argument."""
    for name, fn in inspect.getmembers(mcp_tools, inspect.iscoroutinefunction):
        if fn.__module__ != mcp_tools.__name__:
            continue
        params = set(inspect.signature(fn).parameters)
        assert not {"household_id", "home_id", "user_id"} & params, name


async def test_chores_tools_require_household_context():
    assert "Household context not found" in await get_daily_chores_overview()


async def test_chores_mcp_household_isolation(db_session: AsyncSession):
    """Chores MCP tools use the context household directly (no uuid5 phantom household) and isolate by it."""
    template_a = ChoreTemplate(name="Clean Kitchen", description="Wipe counters", home_id=HOUSEHOLD_A, points=10)
    db_session.add(template_a)
    await db_session.commit()

    # Overview for Household B shows no chores
    with mcp_household_context(household_id=HOUSEHOLD_B, sub=USER_A_SUB):
        assert "No chores scheduled for today" in await get_daily_chores_overview()
        res_b = await complete_chore_by_name(chore_name="Clean Kitchen")
        assert "Error: No chore template found with name 'Clean Kitchen'." in res_b

    # Household A lists and completes it; completed_by is the caller's real user id
    with mcp_household_context(household_id=HOUSEHOLD_A, sub=USER_A_SUB) as ctx:
        assert "Clean Kitchen" in await get_daily_chores_overview()
        res_a = await complete_chore_by_name(chore_name="Clean Kitchen")
        assert "Success: Completed chore 'Clean Kitchen'" in res_a

    instance = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.template_id == template_a.id))).one()
    assert instance.home_id == HOUSEHOLD_A
    assert instance.completed_by == ctx.user_id
    assert instance.completed_by == uuid.uuid5(uuid.NAMESPACE_DNS, USER_A_SUB)


async def test_assign_chore_uses_context_household(db_session: AsyncSession):
    template = ChoreTemplate(name="Laundry", home_id=HOUSEHOLD_A, points=5)
    db_session.add(template)
    await db_session.commit()

    with mcp_household_context(household_id=HOUSEHOLD_A):
        await get_daily_chores_overview()  # generates today's instance
    instance = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.template_id == template.id))).one()

    assignee = uuid.uuid4()
    # Another household cannot assign it
    with mcp_household_context(household_id=HOUSEHOLD_B):
        assert "Success" not in await assign_chore(str(instance.id), str(assignee))

    with (
        mcp_household_context(household_id=HOUSEHOLD_A),
        mcp_membership({(HOUSEHOLD_A, str(assignee)): "MEMBER", (HOUSEHOLD_A, USER_A_SUB): "MEMBER"}),
    ):
        res = await assign_chore(str(instance.id), str(assignee))
        assert f"Success: Assigned chore instance {instance.id} to user {assignee}." == res
        res_sub = await assign_chore(str(instance.id), USER_A_SUB)
        assert str(uuid.uuid5(uuid.NAMESPACE_DNS, USER_A_SUB)) in res_sub


async def test_assign_chore_rejects_non_member_assignee(db_session: AsyncSession):
    """Assigning to an id that isn't a household member is rejected, not silently persisted (#513)."""
    template = ChoreTemplate(name="Mop Kitchen", home_id=HOUSEHOLD_A, points=5)
    db_session.add(template)
    await db_session.commit()

    with mcp_household_context(household_id=HOUSEHOLD_A):
        await get_daily_chores_overview()  # generates today's instance
    instance = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.template_id == template.id))).one()

    stranger = uuid.uuid4()
    with mcp_household_context(household_id=HOUSEHOLD_A), mcp_membership({}):
        res = await assign_chore(str(instance.id), str(stranger))
        assert "Error: The assignee is not a member of this household." == res

    refreshed = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.id == instance.id))).one()
    assert refreshed.assigned_to is None


async def test_assign_chore_requires_elevated_role_for_someone_else(db_session: AsyncSession):
    """A caller without an elevated household role cannot assign a chore to a different member."""
    template = ChoreTemplate(name="Sweep Porch", home_id=HOUSEHOLD_A, points=5)
    db_session.add(template)
    await db_session.commit()

    with mcp_household_context(household_id=HOUSEHOLD_A):
        await get_daily_chores_overview()  # generates today's instance
    instance = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.template_id == template.id))).one()

    other_user = uuid.uuid4()
    with mcp_household_context(household_id=HOUSEHOLD_A, role="MEMBER"):
        res = await assign_chore(str(instance.id), str(other_user))
        assert "Error: Only household owners or admins may assign a chore to someone else." == res

    refreshed = (await db_session.exec(select(ChoreInstance).where(ChoreInstance.id == instance.id))).one()
    assert refreshed.assigned_to is None
