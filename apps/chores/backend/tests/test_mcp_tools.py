import uuid
from unittest.mock import patch

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.mcp_tools import (
    complete_chore_by_name,
    get_daily_chores_overview,
)
from src.features.chore_management.models import ChoreTemplate

HOUSEHOLD_A = "00000000-0000-0000-0000-000000000001"
HOUSEHOLD_B = "00000000-0000-0000-0000-000000000002"
USER_A = "11111111-1111-1111-1111-111111111111"


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


async def test_chores_mcp_household_isolation(db_session: AsyncSession):
    """Verify chores MCP tools strictly isolate data by household_id."""
    template_a = ChoreTemplate(
        name="Clean Kitchen",
        description="Wipe counters",
        home_id=uuid.UUID(HOUSEHOLD_A),
        points=10,
    )
    db_session.add(template_a)
    await db_session.commit()

    # Overview for Household B should show no chores
    overview_b = await get_daily_chores_overview(household_id=HOUSEHOLD_B)
    assert "No chores scheduled for today" in overview_b

    # Overview for Household A should list generated/scheduled chore
    overview_a = await get_daily_chores_overview(household_id=HOUSEHOLD_A)
    assert "Clean Kitchen" in overview_a

    # Completing chore for Household B with Household A's template name should fail
    res_b = await complete_chore_by_name(household_id=HOUSEHOLD_B, user_id=USER_A, chore_name="Clean Kitchen")
    assert "Error: No chore template found with name 'Clean Kitchen'." in res_b

    # Completing chore for Household A should succeed
    res_a = await complete_chore_by_name(household_id=HOUSEHOLD_A, user_id=USER_A, chore_name="Clean Kitchen")
    assert "Success: Completed chore 'Clean Kitchen'" in res_a
