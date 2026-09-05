import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.equipment.exceptions import EquipmentValidationError
from src.features.equipment.models import Equipment, EquipmentScope
from src.features.equipment.schemas import EquipmentCreate, EquipmentUpdate
from src.features.equipment.service import EquipmentService


async def test_equipment_router_not_found_errors(client: AsyncClient):
    """Verify HTTP 404 responses for non-existent equipment."""
    random_id = uuid.uuid4()

    res = await client.get(f"/api/v1/equipment/{random_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Equipment not found."

    res = await client.patch(f"/api/v1/equipment/{random_id}", json={"name": "New Dumbbell"})
    assert res.status_code == 404
    assert res.json()["detail"] == "Equipment not found."

    res = await client.delete(f"/api/v1/equipment/{random_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Equipment not found."


async def test_equipment_service_edge_cases(db_session: AsyncSession):
    """Verify system equipment protection and integrity error trapping."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    eq = await EquipmentService.create_equipment(
        db_session,
        EquipmentCreate(name="Kettlebell 16kg"),
        home_id=home_id,
        user_id=user_id,
    )
    eq_id = eq.id

    # System equipment cannot be updated or deleted
    sys_eq = Equipment(name="Barbell 20kg", scope=EquipmentScope.SYSTEM, home_id=None, owner_user_id=None)
    db_session.add(sys_eq)
    await db_session.commit()
    await db_session.refresh(sys_eq)
    sys_eq_id = sys_eq.id

    assert (
        await EquipmentService.update_equipment(
            db_session, sys_eq_id, home_id, user_id, EquipmentUpdate(name="Renamed")
        )
        is None
    )
    assert await EquipmentService.delete_equipment(db_session, sys_eq_id, home_id, user_id) is False

    # IntegrityError on create, update, delete
    with (
        patch.object(db_session, "commit", AsyncMock(side_effect=IntegrityError("stmt", "params", Exception("orig")))),
        patch.object(db_session, "rollback", AsyncMock()),
    ):
        with pytest.raises(EquipmentValidationError):
            await EquipmentService.create_equipment(db_session, EquipmentCreate(name="Fail Eq"), home_id, user_id)
        with pytest.raises(EquipmentValidationError):
            await EquipmentService.update_equipment(
                db_session, eq_id, home_id, user_id, EquipmentUpdate(name="Fail Update")
            )
        with pytest.raises(EquipmentValidationError):
            await EquipmentService.delete_equipment(db_session, eq_id, home_id, user_id)
