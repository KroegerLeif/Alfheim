"""
Device feature service layer handling database queries and business logic.
"""

from typing import Any, cast

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.features.devices.exceptions import DeviceNotFoundError, HouseholdNotFoundError
from app.features.devices.models import Device, Household
from app.features.devices.schemas import DeviceCreate
from app.features.tasks.models import MaintenanceStep


class DeviceService:
    """Service class containing logic for household and device operations."""

    @staticmethod
    async def get_households(session: AsyncSession, household_id: int) -> list[Household]:
        """Fetch households accessible by the authenticated user.

        Args:
            session: Database session
            household_id: The user's authenticated household_id from context

        Returns:
            List of households the user can access (currently limited to their own)
        """
        result = await session.exec(select(Household).where(Household.id == household_id))
        return list(result.all())

    @staticmethod
    async def get_devices(
        session: AsyncSession,
        household_id: int | None = None,
    ) -> list[Device]:
        """Fetch all devices with eager selectinload for steps and history.

        Supports optional filtering by household_id.
        """
        statement = select(Device).options(
            selectinload(cast(Any, Device.steps)),
            selectinload(cast(Any, Device.history_events)),
        )
        if household_id is not None:
            statement = statement.where(Device.household_id == household_id)

        result = await session.exec(statement)
        return list(result.all())

    @staticmethod
    async def get_device_by_id(session: AsyncSession, device_id: int, household_id: int) -> Device:
        """Fetch a single device by ID with steps and history loaded.

        Args:
            session: Database session
            device_id: The device's primary key
            household_id: The user's authenticated household_id from context

        Raises:
            DeviceNotFoundError: If no device with the given ID exists or belongs to a different household.

        Returns:
            Device with related steps and history events, ensuring tenant isolation.
        """
        statement = (
            select(Device)
            .options(
                selectinload(cast(Any, Device.steps)),
                selectinload(cast(Any, Device.history_events)),
            )
            .where(Device.id == device_id, Device.household_id == household_id)
        )
        result = await session.exec(statement)
        device = result.first()
        if not device:
            raise DeviceNotFoundError(f"Device with ID {device_id} not found")
        return device

    @staticmethod
    async def create_device(
        session: AsyncSession,
        payload: DeviceCreate,
        household_id: int,
    ) -> Device:
        """Create a new Device record and insert all initial MaintenanceStep children.

        The authenticated user's household_id (from context) is used, enforcing that
        the caller cannot create devices in other households.

        Args:
            session: Database session
            payload: Device creation payload from the request
            household_id: The user's authenticated household_id from context

        Executes in an atomic session transaction.

        Raises:
            HouseholdNotFoundError: If the authenticated household_id does not exist.
        """
        household = await session.get(Household, household_id)
        if not household:
            raise HouseholdNotFoundError(f"Household {household_id} not found")

        device = Device(
            name=payload.name,
            model=payload.model,
            serial=payload.serial,
            category=payload.category,
            location=payload.location,
            status=payload.status,
            service_interval_months=payload.service_interval_months,
            notes=payload.notes,
            household_id=household_id,
        )
        session.add(device)
        await session.flush()
        assert device.id is not None

        for step_data in payload.steps:
            step = MaintenanceStep(
                title=step_data.title,
                description=step_data.description,
                recurrence=step_data.recurrence,
                supply_item=step_data.supply_item,
                device_id=device.id,
            )
            session.add(step)

        await session.commit()
        return await DeviceService.get_device_by_id(session, device.id, household_id)
