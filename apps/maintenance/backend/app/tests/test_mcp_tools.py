import uuid
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from app.features.devices.mcp_tools import get_device_detail, get_device_status, list_devices
from app.features.devices.models import Device
from app.features.maintenance.mcp_tools import get_maintenance_summary_tool
from app.features.tasks.mcp_tools import list_overdue_tasks, update_task_state_tool
from app.features.tasks.models import MaintenanceStep
from backend_shared.household.testing import mcp_household_context
from sqlmodel.ext.asyncio.session import AsyncSession


@pytest.fixture(autouse=True)
def override_mcp_session(db_session: AsyncSession):
    """Patch async_session_factory in mcp_tools to use the test db_session."""

    class TestSessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with (
        patch("app.features.devices.mcp_tools.async_session_factory", side_effect=TestSessionContext),
        patch("app.features.tasks.mcp_tools.async_session_factory", side_effect=TestSessionContext),
        patch("app.features.maintenance.mcp_tools.async_session_factory", side_effect=TestSessionContext),
    ):
        yield


async def test_maintenance_mcp_household_isolation(db_session: AsyncSession):
    """Verify maintenance MCP tools only see the household from the MCP context (UUID, never LLM-supplied)."""
    hh1_id = uuid.uuid4()
    hh2_id = uuid.uuid4()

    dev1 = Device(
        name="Fridge A",
        model="X1",
        serial="SN123",
        category="Appliance",
        location="Kitchen",
        status="good",
        household_id=hh1_id,
    )
    dev2 = Device(
        name="Fridge B",
        model="Y2",
        serial="SN456",
        category="Appliance",
        location="Garage",
        status="good",
        household_id=hh2_id,
    )
    db_session.add(dev1)
    db_session.add(dev2)
    await db_session.commit()
    await db_session.refresh(dev1)
    await db_session.refresh(dev2)
    assert dev1.id is not None
    dev1_id: int = dev1.id

    overdue_step = MaintenanceStep(
        title="Defrost",
        recurrence=6,
        device_id=dev1_id,
        supply_needed_date=(date.today() - timedelta(days=3)).isoformat(),
    )
    db_session.add(overdue_step)
    await db_session.commit()
    await db_session.refresh(overdue_step)
    assert overdue_step.id is not None

    with mcp_household_context(household_id=hh1_id, sub="test-user-1"):
        res1 = await list_devices()
        status1 = await get_device_status(device_name="Fridge")
        detail_ok = await get_device_detail(device_id=dev1_id)
        summary1 = await get_maintenance_summary_tool()
        overdue1 = await list_overdue_tasks()

    assert res1["total"] == 1
    assert res1["devices"][0]["name"] == "Fridge A"
    assert res1["devices"][0]["household_id"] == str(hh1_id)

    assert status1["found"] is True
    assert [d["name"] for d in status1["devices"]] == ["Fridge A"]

    assert "error" not in detail_ok
    assert detail_ok["name"] == "Fridge A"

    assert summary1["summaries"][0]["household_id"] == str(hh1_id)
    assert summary1["summaries"][0]["total_devices"] == 1

    assert [t["step_id"] for t in overdue1["tasks"]] == [overdue_step.id]

    # Cross-tenant: household 2 cannot read or modify household 1's device/steps
    with mcp_household_context(household_id=hh2_id, sub="test-user-2"):
        detail_cross = await get_device_detail(device_id=dev1_id)
        overdue_cross = await list_overdue_tasks()
        update_cross = await update_task_state_tool(step_id=overdue_step.id, comment="hijack")

    assert "error" in detail_cross
    assert "not authorized" in detail_cross["error"]
    assert overdue_cross["total_overdue"] == 0
    assert update_cross["success"] is False

    await db_session.refresh(overdue_step)
    assert overdue_step.description != "hijack"


async def test_mcp_tools_without_household_context_refuse():
    """Without MCPAuthenticationMiddleware there is no context, and tools return an error instead of guessing."""
    result = await list_devices()
    assert "Household context not found" in result["error"]
