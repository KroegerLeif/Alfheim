import uuid

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.locations.models import Location, LocationCreate, LocationUpdate
from src.features.locations.service import LocationService


def test_location_model_defaults():
    """Verify that Location model attributes construct with correct defaults."""
    loc = Location(name="Kitchen Pantry")
    assert loc.name == "Kitchen Pantry"
    assert loc.is_system is False
    assert loc.description is None
    assert loc.owner_id is None
    assert loc.home_id is None


async def test_get_location_missing(db_session: AsyncSession):
    """Verify LocationService returns None for non-existent location."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await LocationService.get_location(db_session, fake_id, home_id)
    assert res is None


async def test_update_location_missing(db_session: AsyncSession):
    """Verify LocationService returns None when updating non-existent location."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await LocationService.update_location(db_session, fake_id, home_id, LocationUpdate(name="Cabinet"))
    assert res is None


async def test_update_location_system_blocked(db_session: AsyncSession):
    """Verify LocationService blocks modifying system locations."""
    home_id = uuid.uuid4()
    sys_loc = Location(name="Backlog", is_system=True, home_id=home_id)
    db_session.add(sys_loc)
    await db_session.commit()

    with pytest.raises(ValueError) as exc:
        await LocationService.update_location(db_session, sys_loc.id, home_id, LocationUpdate(name="Renamed"))
    assert "System locations cannot be modified" in str(exc.value)


async def test_delete_location_missing(db_session: AsyncSession):
    """Verify LocationService returns False when deleting non-existent location."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await LocationService.delete_location(db_session, fake_id, home_id)
    assert res is False


async def test_delete_location_system_blocked(db_session: AsyncSession):
    """Verify LocationService blocks deleting system locations."""
    home_id = uuid.uuid4()
    sys_loc = Location(name="Backlog", is_system=True, home_id=home_id)
    db_session.add(sys_loc)
    await db_session.commit()

    with pytest.raises(ValueError) as exc:
        await LocationService.delete_location(db_session, sys_loc.id, home_id)
    assert "System locations cannot be modified" in str(exc.value)


async def test_delete_location_no_fallback_location(db_session: AsyncSession):
    """Verify LocationService raises ValueError if deleting a custom location but system Backlog is missing."""
    owner_id = uuid.uuid4()
    home_id = uuid.uuid4()

    custom_loc = await LocationService.create_location(
        db_session, LocationCreate(name="Custom Drawer"), owner_id, home_id
    )

    # Note: We do NOT seed the system Backlog location, so it's missing
    with pytest.raises(ValueError) as exc:
        await LocationService.delete_location(db_session, custom_loc.id, home_id)
    assert "System fallback location ('Backlog') could not be found" in str(exc.value)
