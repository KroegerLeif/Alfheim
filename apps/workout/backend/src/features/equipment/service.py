import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import and_, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.equipment.exceptions import EquipmentValidationError
from src.features.equipment.models import Equipment, EquipmentScope
from src.features.equipment.schemas import EquipmentCreate, EquipmentUpdate


def _visibility_filter(home_id: uuid.UUID, user_id: uuid.UUID):
    """Build the scope-union visibility predicate: system OR own-household OR own-user rows."""
    return or_(
        Equipment.scope == EquipmentScope.SYSTEM,
        and_(Equipment.scope == EquipmentScope.HOUSEHOLD, Equipment.home_id == home_id),
        and_(Equipment.scope == EquipmentScope.USER, Equipment.owner_user_id == user_id),
    )


def _writable_filter(home_id: uuid.UUID, user_id: uuid.UUID):
    """Build the writable-ownership predicate: system rows are never writable via the API."""
    return or_(
        and_(Equipment.scope == EquipmentScope.HOUSEHOLD, Equipment.home_id == home_id),
        and_(Equipment.scope == EquipmentScope.USER, Equipment.owner_user_id == user_id),
    )


class EquipmentService:
    """Service class encapsulating async database operations for Equipment."""

    @staticmethod
    async def create_equipment(
        session: AsyncSession,
        payload: EquipmentCreate,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Equipment:
        """Create a new household- or user-scoped equipment entry.

        System-scoped equipment cannot be created through the API; it is only
        seeded at application startup.
        """
        if payload.scope == EquipmentScope.SYSTEM:
            raise EquipmentValidationError("System-scoped equipment cannot be created via the API.")

        equipment = Equipment(
            scope=payload.scope,
            name=payload.name,
            category=payload.category,
            home_id=home_id if payload.scope == EquipmentScope.HOUSEHOLD else None,
            owner_user_id=user_id if payload.scope == EquipmentScope.USER else None,
        )
        session.add(equipment)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise EquipmentValidationError(f"Failed to create equipment: {e}") from e
        await session.refresh(equipment)
        return equipment

    @staticmethod
    async def list_equipment(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        is_active: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Equipment]:
        """Retrieve all equipment visible to the caller: system + own household + own user entries."""
        statement = select(Equipment).where(_visibility_filter(home_id, user_id))

        if is_active is not None:
            statement = statement.where(Equipment.is_active == is_active)

        statement = statement.order_by(Equipment.name).offset(offset).limit(limit)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def get_equipment(
        session: AsyncSession,
        equipment_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Equipment | None:
        """Retrieve a single equipment entry, scoped to what the caller may see."""
        statement = select(Equipment).where(
            Equipment.id == equipment_id,
            _visibility_filter(home_id, user_id),
        )
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def update_equipment(
        session: AsyncSession,
        equipment_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: EquipmentUpdate,
    ) -> Equipment | None:
        """Partially update an equipment entry the caller owns. System entries are never writable."""
        equipment = await EquipmentService._get_writable(session, equipment_id, home_id, user_id)
        if not equipment:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(equipment, key, value)

        session.add(equipment)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise EquipmentValidationError(f"Failed to update equipment: {e}") from e
        await session.refresh(equipment)
        return equipment

    @staticmethod
    async def delete_equipment(
        session: AsyncSession,
        equipment_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """Delete an equipment entry the caller owns. System entries are never writable."""
        equipment = await EquipmentService._get_writable(session, equipment_id, home_id, user_id)
        if not equipment:
            return False

        await session.delete(equipment)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise EquipmentValidationError(f"Failed to delete equipment: {e}") from e
        return True

    @staticmethod
    async def _get_writable(
        session: AsyncSession,
        equipment_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Equipment | None:
        statement = select(Equipment).where(
            Equipment.id == equipment_id,
            _writable_filter(home_id, user_id),
        )
        result = await session.exec(statement)
        return result.first()
