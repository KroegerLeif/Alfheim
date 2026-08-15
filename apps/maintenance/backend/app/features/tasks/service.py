"""
Task feature service layer handling database operations and inter-service HTTP integration.
"""

import datetime
import logging
from typing import Any

import httpx
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.features.devices.exceptions import DeviceNotFoundError
from app.features.devices.models import Device
from app.features.devices.schemas import ServiceHistoryEventDetailRead
from app.features.tasks.exceptions import InvalidStepError, StepNotFoundError
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
from app.features.tasks.schemas import MaintenanceSubmission, TaskStateUpdate

logger = logging.getLogger(__name__)


def add_months(source_date: datetime.date, months: int) -> datetime.date:
    """Helper to add months to a date, handling month-end constraints correctly."""
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(
        source_date.day,
        [
            31,
            29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
        ][month - 1],
    )
    return datetime.date(year, month, day)


class TaskService:
    """Service class containing domain logic for maintenance tasks and history."""

    @staticmethod
    async def forward_supplies_to_shopping(supply_items: list[str]) -> None:
        """Send parts list to the shopping-backend microservice via HTTP POST."""
        async with httpx.AsyncClient() as client:
            for item in supply_items:
                try:
                    payload = {"name": item, "quantity": 1.0, "unit": "piece"}
                    response = await client.post(
                        "http://shopping-backend:8000/api/v1/shopping/items",
                        json=payload,
                        timeout=5.0,
                    )
                    if response.status_code >= 400:
                        logger.error(
                            "Failed to forward item '%s' to shopping backend: status %d",
                            item,
                            response.status_code,
                        )
                except Exception as e:
                    logger.error("Error forwarding item '%s' to shopping backend: %s", item, e)

    @staticmethod
    async def get_history(
        session: AsyncSession,
        household_id: int | None = None,
    ) -> list[ServiceHistoryEventDetailRead]:
        """Fetch all ServiceHistoryEvent records joined with their Device.

        Results are ordered descending by date.
        """
        statement = (
            select(ServiceHistoryEvent)
            .options(selectinload(ServiceHistoryEvent.device))
            .order_by(ServiceHistoryEvent.date.desc())
        )
        result = await session.exec(statement)
        events = list(result.all())

        if household_id is not None:
            events = [e for e in events if e.device and e.device.household_id == household_id]

        return [
            ServiceHistoryEventDetailRead(
                id=e.id,
                date=e.date,
                performer=e.performer,
                notes=e.notes,
                device_id=e.device_id,
                device_name=e.device.name if e.device else "Unknown",
                device_location=e.device.location if e.device else "Unknown",
                completed_steps=e.completed_steps,
            )
            for e in events
        ]

    @staticmethod
    async def submit_maintenance_wizard(
        session: AsyncSession,
        payload: MaintenanceSubmission,
    ) -> ServiceHistoryEvent:
        """Log a new service history event and update completed steps' due dates."""
        device = await session.get(Device, payload.device_id)
        if not device:
            raise DeviceNotFoundError("Device not found")

        completed_steps_titles = []
        if payload.completed_step_ids:
            steps_statement = select(MaintenanceStep).where(
                MaintenanceStep.id.in_(payload.completed_step_ids),
                MaintenanceStep.device_id == payload.device_id,
            )
            result = await session.exec(steps_statement)
            completed_steps = list(result.all())

            if len(completed_steps) != len(payload.completed_step_ids):
                raise InvalidStepError("One or more step IDs are invalid for this device")

            today = datetime.date.today()
            for step in completed_steps:
                completed_steps_titles.append(step.title)
                step.last_completed = today.isoformat()
                step.supply_needed_date = add_months(today, step.recurrence).isoformat()
                session.add(step)

        event = ServiceHistoryEvent(
            date=datetime.date.today().isoformat(),
            performer=payload.performer,
            notes=payload.step_notes,
            device_id=payload.device_id,
            completed_steps=completed_steps_titles,
        )
        session.add(event)

        await session.commit()
        await session.refresh(event)

        if payload.supply_items:
            try:
                await TaskService.forward_supplies_to_shopping(payload.supply_items)
            except Exception as e:
                logger.error("Uncaught exception during supply forwarding: %s", e)

        return event

    @staticmethod
    async def update_task_state(
        session: AsyncSession,
        step_id: int,
        payload: TaskStateUpdate,
    ) -> MaintenanceStep:
        """Persist lightweight step updates (comments, supply dates, supply items)."""
        step = await session.get(MaintenanceStep, step_id)
        if not step:
            raise StepNotFoundError(f"MaintenanceStep {step_id} not found")

        if payload.comment is not None:
            step.description = payload.comment
        if payload.supply_needed_date is not None:
            step.supply_needed_date = payload.supply_needed_date
        if payload.supply_item is not None:
            step.supply_item = payload.supply_item

        session.add(step)
        await session.commit()
        await session.refresh(step)
        return step

    @staticmethod
    async def get_overdue_tasks(session: AsyncSession) -> list[dict[str, Any]]:
        """Fetch all maintenance steps currently overdue across all devices."""
        statement = select(MaintenanceStep).options(selectinload(MaintenanceStep.device))
        result = await session.exec(statement)
        all_steps = list(result.all())

        today = datetime.date.today()
        overdue = []

        for step in all_steps:
            if not step.supply_needed_date:
                continue
            try:
                due = datetime.date.fromisoformat(step.supply_needed_date)
            except ValueError:
                continue

            if due < today:
                days_overdue = (today - due).days
                overdue.append(
                    {
                        "step_id": step.id,
                        "title": step.title,
                        "device_id": step.device_id,
                        "device_name": step.device.name if step.device else "Unknown",
                        "device_location": step.device.location if step.device else "Unknown",
                        "due_date": step.supply_needed_date,
                        "days_overdue": days_overdue,
                        "supply_item": step.supply_item,
                        "last_completed": step.last_completed,
                    }
                )

        overdue.sort(key=lambda x: x["days_overdue"], reverse=True)
        return overdue
