import uuid
from unittest.mock import patch

import pytest
from backend_shared.mcp_middleware import UserHouseholdContext, mcp_user_context
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.mcp_tools import (
    complete_chore_by_name,
    get_daily_chores_overview,
)
from src.features.chore_management.models import ChoreTemplate

HOUSEHOLD_A_ID = 1
HOUSEHOLD_B_ID = 2
USER_A_ID = "test-user-a"


@pytest.fixture
def set_mcp_context():
    """Fixture to set MCP user context for tests."""
    def _set_context(user_id: str, household_id: int):
        context = UserHouseholdContext(
            user_id=user_id,
            household_id=household_id,
        )
        mcp_user_context.set(context)
    return _set_context


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


async def test_chores_mcp_household_isolation(db_session: AsyncSession, set_mcp_context):
    """Verify chores MCP tools strictly isolate data by household_id."""
    # Derive home_id using the same UUID5 derivation as the production code
    home_uuid_a = uuid.uuid5(uuid.NAMESPACE_DNS, str(HOUSEHOLD_A_ID))
    home_uuid_b = uuid.uuid5(uuid.NAMESPACE_DNS, str(HOUSEHOLD_B_ID))

    template_a = ChoreTemplate(
        name="Clean Kitchen",
        description="Wipe counters",
        home_id=home_uuid_a,
        points=10,
    )
    db_session.add(template_a)
    await db_session.commit()

    # Overview for Household B should show no chores
    set_mcp_context(USER_A_ID, HOUSEHOLD_B_ID)
    overview_b = await get_daily_chores_overview()
    assert "No chores scheduled for today" in overview_b

    # Overview for Household A should list generated/scheduled chore
    set_mcp_context(USER_A_ID, HOUSEHOLD_A_ID)
    overview_a = await get_daily_chores_overview()
    assert "Clean Kitchen" in overview_a

    # Completing chore for Household B with Household A's template name should fail
    set_mcp_context(USER_A_ID, HOUSEHOLD_B_ID)
    res_b = await complete_chore_by_name(chore_name="Clean Kitchen")
    assert "Error: No chore template found with name 'Clean Kitchen'." in res_b

    # Completing chore for Household A should succeed
    set_mcp_context(USER_A_ID, HOUSEHOLD_A_ID)
    res_a = await complete_chore_by_name(chore_name="Clean Kitchen")
    assert "Success: Completed chore 'Clean Kitchen'" in res_a
