"""
Device feature service layer handling database queries and business logic.
"""

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
    async def get_households(session: AsyncSession) -> list[Household]:
        """Fetch all registered households from the database."""
        result = await session.exec(select(Household))
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
            selectinload(Device.steps),
            selectinload(Device.history_events),
        )
        if household_id is not None:
            statement = statement.where(Device.household_id == household_id)

        result = await session.exec(statement)
        return list(result.all())

    @staticmethod
    async def get_device_by_id(session: AsyncSession, device_id: int) -> Device:
        """Fetch a single device by ID with steps and history loaded.

        Raises:
            DeviceNotFoundError: If no device with the given ID exists.
        """
        statement = (
            select(Device)
            .options(
                selectinload(Device.steps),
                selectinload(Device.history_events),
            )
            .where(Device.id == device_id)
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
    ) -> Device:
        """Create a new Device record and insert all initial MaintenanceStep children.

        Executes in an atomic session transaction.

        Raises:
            HouseholdNotFoundError: If the specified household_id does not exist.
        """
        household = await session.get(Household, payload.household_id)
        if not household:
            raise HouseholdNotFoundError(f"Household {payload.household_id} not found")

        device = Device(
            name=payload.name,
            model=payload.model,
            serial=payload.serial,
            category=payload.category,
            location=payload.location,
            status=payload.status,
            service_interval_months=payload.service_interval_months,
            notes=payload.notes,
            household_id=payload.household_id,
        )
        session.add(device)
        await session.flush()

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
        return await DeviceService.get_device_by_id(session, device.id)
