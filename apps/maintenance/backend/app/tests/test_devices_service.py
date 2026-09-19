import uuid

import pytest
from app.features.devices.exceptions import DeviceNotFoundError
from app.features.devices.schemas import DeviceCreate, StepCreate
from app.features.devices.service import DeviceService
from sqlmodel.ext.asyncio.session import AsyncSession


async def test_create_and_get_device(db_session: AsyncSession):
    """Test creating a device with maintenance steps and retrieving it."""
    household_id = uuid.uuid4()

    payload = DeviceCreate(
        name="Filter Pump",
        model="Pump-3000",
        serial="SN-12345",
        category="HVAC",
        location="Basement",
        status="active",
        service_interval_months=6,
        notes="Inspect monthly",
        steps=[
            StepCreate(
                title="Replace Filter Element",
                description="Replace paper cartridge filter",
                recurrence=1,
                supply_item="Filter Cartridge A",
            )
        ],
    )

    created_device = await DeviceService.create_device(db_session, payload, household_id=household_id)
    assert created_device.id is not None
    assert created_device.name == "Filter Pump"
    assert created_device.household_id == household_id
    assert len(created_device.steps) == 1
    assert created_device.steps[0].title == "Replace Filter Element"

    # Test get_device_by_id
    retrieved_device = await DeviceService.get_device_by_id(db_session, created_device.id, household_id=household_id)
    assert retrieved_device.id == created_device.id
    assert retrieved_device.name == "Filter Pump"

    # Test get_devices scoped to the household
    household_devices = await DeviceService.get_devices(db_session, household_id=household_id)
    assert len(household_devices) == 1
    assert household_devices[0].id == created_device.id

    # Other households see nothing
    assert await DeviceService.get_devices(db_session, household_id=uuid.uuid4()) == []
    with pytest.raises(DeviceNotFoundError):
        await DeviceService.get_device_by_id(db_session, created_device.id, household_id=uuid.uuid4())


async def test_get_device_by_id_not_found(db_session: AsyncSession):
    """Test error raised when requesting a non-existent device ID."""
    with pytest.raises(DeviceNotFoundError) as exc_info:
        await DeviceService.get_device_by_id(db_session, 888888, household_id=uuid.uuid4())

    assert "Device with ID 888888 not found" in str(exc_info.value)
