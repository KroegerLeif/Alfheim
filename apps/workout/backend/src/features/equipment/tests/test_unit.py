import uuid

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.equipment.exceptions import EquipmentValidationError
from src.features.equipment.models import EquipmentScope
from src.features.equipment.schemas import EquipmentCreate, EquipmentUpdate
from src.features.equipment.service import EquipmentService


async def test_create_household_equipment_sets_home_id(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    payload = EquipmentCreate(name="Barbell", scope=EquipmentScope.HOUSEHOLD)

    equipment = await EquipmentService.create_equipment(db_session, payload, home_id, user_id)

    assert equipment.home_id == home_id
    assert equipment.owner_user_id is None
    assert equipment.scope == EquipmentScope.HOUSEHOLD


async def test_create_user_equipment_sets_owner_only(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    payload = EquipmentCreate(name="Resistance Band", scope=EquipmentScope.USER)

    equipment = await EquipmentService.create_equipment(db_session, payload, home_id, user_id)

    assert equipment.owner_user_id == user_id
    assert equipment.home_id is None


async def test_create_system_equipment_via_api_rejected(db_session: AsyncSession):
    payload = EquipmentCreate(name="Hack", scope=EquipmentScope.SYSTEM)

    with pytest.raises(EquipmentValidationError):
        await EquipmentService.create_equipment(db_session, payload, uuid.uuid4(), uuid.uuid4())


async def test_list_equipment_returns_system_and_own_household(db_session: AsyncSession):
    home_id = uuid.uuid4()
    other_home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    await EquipmentService.create_equipment(
        db_session, EquipmentCreate(name="My Barbell", scope=EquipmentScope.HOUSEHOLD), home_id, user_id
    )
    await EquipmentService.create_equipment(
        db_session, EquipmentCreate(name="Other Barbell", scope=EquipmentScope.HOUSEHOLD), other_home_id, user_id
    )

    results = await EquipmentService.list_equipment(db_session, home_id, user_id)
    names = {e.name for e in results}

    assert "My Barbell" in names
    assert "Other Barbell" not in names


async def test_update_system_equipment_not_writable(db_session: AsyncSession):
    from src.features.equipment.models import Equipment

    system_item = Equipment(scope=EquipmentScope.SYSTEM, name="Treadmill")
    db_session.add(system_item)
    await db_session.commit()
    await db_session.refresh(system_item)

    result = await EquipmentService.update_equipment(
        db_session, system_item.id, uuid.uuid4(), uuid.uuid4(), EquipmentUpdate(name="Hacked")
    )

    assert result is None


async def test_delete_equipment_removes_row(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    equipment = await EquipmentService.create_equipment(
        db_session, EquipmentCreate(name="Kettlebell", scope=EquipmentScope.HOUSEHOLD), home_id, user_id
    )

    deleted = await EquipmentService.delete_equipment(db_session, equipment.id, home_id, user_id)
    assert deleted is True

    fetched = await EquipmentService.get_equipment(db_session, equipment.id, home_id, user_id)
    assert fetched is None
