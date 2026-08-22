import pytest
from app.features.devices.exceptions import DeviceNotFoundError, HouseholdNotFoundError
from app.features.devices.models import Household
from app.features.devices.schemas import DeviceCreate, StepCreate
from app.features.devices.service import DeviceService
from sqlmodel.ext.asyncio.session import AsyncSession


@pytest.fixture
async def sample_household(db_session: AsyncSession) -> Household:
    """Fixture to create a sample household record."""
    household = Household(name="Test Household", slug="test-household")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    return household


async def test_get_households(db_session: AsyncSession, sample_household: Household):
    """Test retrieving all households."""
    households = await DeviceService.get_households(db_session)
    assert len(households) >= 1
    assert any(h.id == sample_household.id for h in households)


async def test_create_and_get_device(db_session: AsyncSession, sample_household: Household):
    """Test creating a device with maintenance steps and retrieving it."""
    assert sample_household.id is not None
    household_id: int = sample_household.id

    payload = DeviceCreate(
        name="Filter Pump",
        model="Pump-3000",
        serial="SN-12345",
        category="HVAC",
        location="Basement",
        status="active",
        service_interval_months=6,
        notes="Inspect monthly",
        household_id=household_id,
        steps=[
            StepCreate(
                title="Replace Filter Element",
                description="Replace paper cartridge filter",
                recurrence=1,
                supply_item="Filter Cartridge A",
            )
        ],
    )

    created_device = await DeviceService.create_device(db_session, payload)
    assert created_device.id is not None
    assert created_device.name == "Filter Pump"
    assert created_device.household_id == household_id
    assert len(created_device.steps) == 1
    assert created_device.steps[0].title == "Replace Filter Element"

    # Test get_device_by_id
    retrieved_device = await DeviceService.get_device_by_id(db_session, created_device.id)
    assert retrieved_device.id == created_device.id
    assert retrieved_device.name == "Filter Pump"

    # Test get_devices (unfiltered)
    all_devices = await DeviceService.get_devices(db_session)
    assert len(all_devices) >= 1
    assert any(d.id == created_device.id for d in all_devices)

    # Test get_devices filtered by household_id
    household_devices = await DeviceService.get_devices(db_session, household_id=household_id)
    assert len(household_devices) == 1
    assert household_devices[0].id == created_device.id

    # Test get_devices filtered by non-existent household_id
    empty_devices = await DeviceService.get_devices(db_session, household_id=999999)
    assert len(empty_devices) == 0


async def test_create_device_household_not_found(db_session: AsyncSession):
    """Test error raised when creating a device for a non-existent household."""
    payload = DeviceCreate(
        name="Nonexistent Device",
        model="Model-X",
        serial="SN-999",
        category="General",
        location="Garage",
        household_id=999999,
        steps=[],
    )
    with pytest.raises(HouseholdNotFoundError) as exc_info:
        await DeviceService.create_device(db_session, payload)

    assert "Household 999999 not found" in str(exc_info.value)


async def test_get_device_by_id_not_found(db_session: AsyncSession):
    """Test error raised when requesting a non-existent device ID."""
    with pytest.raises(DeviceNotFoundError) as exc_info:
        await DeviceService.get_device_by_id(db_session, 888888)

    assert "Device with ID 888888 not found" in str(exc_info.value)
