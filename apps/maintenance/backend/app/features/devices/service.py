"""Device feature service layer handling database queries and business logic."""

import datetime
import uuid
from typing import Any, cast

from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.features.devices.exceptions import DeviceNotFoundError, DeviceStepNotFoundError
from app.features.devices.models import Device
from app.features.devices.schemas import DeviceCreate, DeviceUpdate, StepCreate, StepUpdate
from app.features.tasks.models import MaintenanceStep
from app.features.tasks.service import add_months


def first_due_date(recurrence: int, today: datetime.date | None = None) -> str:
    """Due date of a step that was never completed: one interval from today (#621).

    Without it a new step has no due date, so it never becomes due, never shows up in the
    upcoming view and raises no notification until someone completes it once.
    """
    return add_months(today or datetime.date.today(), recurrence).isoformat()


def _new_step(step_data: StepCreate, device_id: int) -> MaintenanceStep:
    """Build a step of ``device_id`` with its first due date seeded."""
    return MaintenanceStep(
        title=step_data.title,
        description=step_data.description,
        recurrence=step_data.recurrence,
        supply_item=step_data.supply_item,
        supply_needed_date=first_due_date(step_data.recurrence),
        device_id=device_id,
    )


class DeviceService:
    """Service class containing logic for household and device operations."""

    @staticmethod
    async def get_devices(
        session: AsyncSession,
        household_id: uuid.UUID,
    ) -> list[Device]:
        """Fetch all devices of a household with eager selectinload for steps and history."""
        statement = select(Device).options(
            selectinload(cast(Any, Device.steps)),
            selectinload(cast(Any, Device.history_events)),
        )
        statement = statement.where(Device.household_id == household_id)

        result = await session.exec(statement)
        return list(result.all())

    @staticmethod
    async def get_device_by_id(session: AsyncSession, device_id: int, household_id: uuid.UUID) -> Device:
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
        household_id: uuid.UUID,
    ) -> Device:
        """Create a new Device record and insert all initial MaintenanceStep children.

        The household confirmed by the household app (request context) is used, so the
        caller cannot create devices in other households.

        Args:
            session: Database session
            payload: Device creation payload from the request
            household_id: The user's authenticated household_id from context

        Executes in an atomic session transaction.
        """
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
            session.add(_new_step(step_data, device.id))

        await session.commit()
        return await DeviceService.get_device_by_id(session, device.id, household_id)

    @staticmethod
    async def update_device(
        session: AsyncSession,
        device_id: int,
        payload: DeviceUpdate,
        household_id: uuid.UUID,
    ) -> Device:
        """Apply the fields set in ``payload`` to a device of the household.

        Raises:
            DeviceNotFoundError: If the device does not exist or belongs to a different household.
        """
        device = await DeviceService.get_device_by_id(session, device_id, household_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(device, field, value)
        session.add(device)
        await session.commit()
        return await DeviceService.get_device_by_id(session, device_id, household_id)

    @staticmethod
    async def delete_device(session: AsyncSession, device_id: int, household_id: uuid.UUID) -> None:
        """Delete a device of the household together with its steps and service history.

        Raises:
            DeviceNotFoundError: If the device does not exist or belongs to a different household.
        """
        device = await DeviceService.get_device_by_id(session, device_id, household_id)
        await session.delete(device)
        await session.commit()

    @staticmethod
    async def add_step(
        session: AsyncSession,
        device_id: int,
        payload: StepCreate,
        household_id: uuid.UUID,
    ) -> MaintenanceStep:
        """Add a maintenance step to a device of the household, with its first due date seeded.

        Raises:
            DeviceNotFoundError: If the device does not exist or belongs to a different household.
        """
        await DeviceService.get_device_by_id(session, device_id, household_id)
        step = _new_step(payload, device_id)
        session.add(step)
        await session.commit()
        await session.refresh(step)
        return step

    @staticmethod
    async def _get_step(
        session: AsyncSession, device_id: int, step_id: int, household_id: uuid.UUID
    ) -> MaintenanceStep:
        """Load a step of a device of the household or raise DeviceStepNotFoundError."""
        statement = (
            select(MaintenanceStep)
            .join(Device, col(Device.id) == col(MaintenanceStep.device_id))
            .where(
                MaintenanceStep.id == step_id,
                MaintenanceStep.device_id == device_id,
                col(Device.household_id) == household_id,
            )
        )
        step = (await session.exec(statement)).first()
        if not step:
            raise DeviceStepNotFoundError(f"Maintenance step {step_id} not found on device {device_id}")
        return step

    @staticmethod
    async def update_step(
        session: AsyncSession,
        device_id: int,
        step_id: int,
        payload: StepUpdate,
        household_id: uuid.UUID,
    ) -> MaintenanceStep:
        """Apply the fields set in ``payload`` to a step of a device of the household.

        A changed interval moves the due date to one new interval after the last completion, or
        after today for a step that was never completed.

        Raises:
            DeviceStepNotFoundError: If the step does not exist on that device of the household.
        """
        step = await DeviceService._get_step(session, device_id, step_id, household_id)
        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(step, field, value)
        if "recurrence" in changes:
            base = datetime.date.fromisoformat(step.last_completed) if step.last_completed else None
            step.supply_needed_date = first_due_date(step.recurrence, base)
        session.add(step)
        await session.commit()
        await session.refresh(step)
        return step

    @staticmethod
    async def delete_step(session: AsyncSession, device_id: int, step_id: int, household_id: uuid.UUID) -> None:
        """Delete a step of a device of the household.

        Raises:
            DeviceStepNotFoundError: If the step does not exist on that device of the household.
        """
        step = await DeviceService._get_step(session, device_id, step_id, household_id)
        await session.delete(step)
        await session.commit()
