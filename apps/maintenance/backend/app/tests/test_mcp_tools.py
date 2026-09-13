from unittest.mock import patch

import pytest
from app.features.devices.mcp_tools import get_device_detail, get_device_status, list_devices
from app.features.devices.models import Device, Household
from backend_shared.mcp_middleware import UserHouseholdContext, mcp_user_context
from sqlmodel.ext.asyncio.session import AsyncSession


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

    with (
        patch("app.features.devices.mcp_tools.async_session_factory", side_effect=TestSessionContext),
        patch("app.features.tasks.mcp_tools.async_session_factory", side_effect=TestSessionContext),
    ):
        yield


async def test_maintenance_mcp_household_isolation(db_session: AsyncSession, set_mcp_context):
    """Verify maintenance MCP tools enforce household_id isolation."""
    hh1 = Household(name="Household One")
    hh2 = Household(name="Household Two")
    db_session.add(hh1)
    db_session.add(hh2)
    await db_session.commit()
    await db_session.refresh(hh1)
    await db_session.refresh(hh2)

    assert hh1.id is not None
    assert hh2.id is not None
    hh1_id: int = hh1.id
    hh2_id: int = hh2.id

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
    assert dev2.id is not None
    dev1_id: int = dev1.id

    # Test with household 1 context
    set_mcp_context("test-user-1", hh1_id)

    # list_devices
    res1 = await list_devices()
    assert res1["total"] == 1
    assert res1["devices"][0]["name"] == "Fridge A"

    # get_device_status
    status1 = await get_device_status(device_name="Fridge")
    assert status1["found"] is True
    assert len(status1["devices"]) == 1
    assert status1["devices"][0]["name"] == "Fridge A"

    # get_device_detail - should succeed with correct household
    detail_ok = await get_device_detail(device_id=dev1_id)
    assert "error" not in detail_ok
    assert detail_ok["name"] == "Fridge A"

    # get_device_detail cross-tenant rejection - switch to household 2 context
    set_mcp_context("test-user-2", hh2_id)
    detail_cross = await get_device_detail(device_id=dev1_id)
    assert "error" in detail_cross
    assert "not authorized" in detail_cross["error"]
