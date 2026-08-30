from unittest.mock import patch

import pytest
from app.features.devices.mcp_tools import get_device_detail, get_device_status, list_devices
from app.features.devices.models import Device, Household
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
    ):
        yield


async def test_maintenance_mcp_household_isolation(db_session: AsyncSession):
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

    # list_devices
    res1 = await list_devices(household_id=hh1_id)
    assert res1["total"] == 1
    assert res1["devices"][0]["name"] == "Fridge A"

    # get_device_status
    status1 = await get_device_status(household_id=hh1_id, device_name="Fridge")
    assert status1["found"] is True
    assert len(status1["devices"]) == 1
    assert status1["devices"][0]["name"] == "Fridge A"

    # get_device_detail cross-tenant rejection
    detail_cross = await get_device_detail(household_id=hh2_id, device_id=dev1_id)
    assert "error" in detail_cross
    assert "not authorized" in detail_cross["error"]
