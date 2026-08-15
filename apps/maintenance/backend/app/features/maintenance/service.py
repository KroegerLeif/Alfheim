"""
Maintenance feature service layer providing orchestration logic for wizard sessions and summary calculations.
"""

import datetime
import logging
from typing import Any, cast

from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.features.devices.exceptions import DeviceNotFoundError
from app.features.devices.models import Device, Household
from app.features.maintenance.exceptions import WizardValidationError
from app.features.maintenance.schemas import (
    HouseholdMaintenanceSummary,
    MaintenanceSummary,
    WizardSessionPayload,
    WizardSessionResult,
    WizardStepResult,
)
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
from app.features.tasks.service import TaskService, add_months

logger = logging.getLogger(__name__)


def days_until(iso_date: str | None) -> int:
    """Return calendar days until an ISO date string (negative = overdue)."""
    if not iso_date:
        return 9999
    try:
        return (datetime.date.fromisoformat(iso_date) - datetime.date.today()).days
    except ValueError:
        return 9999


class MaintenanceService:
    """Orchestration service for maintenance wizard sessions and dashboard summaries."""

    @staticmethod
    async def submit_wizard_session(
        session: AsyncSession,
        payload: WizardSessionPayload,
    ) -> WizardSessionResult:
        """Process and persist a completed maintenance wizard session."""
        device = await session.get(Device, payload.device_id)
        if not device:
            raise DeviceNotFoundError(f"Device {payload.device_id} not found")

        today = datetime.date.today()
        completed_step_ids = [entry.step_id for entry in payload.completed_steps]
        completed_step_map = {entry.step_id: entry for entry in payload.completed_steps}

        updated_step_results: list[WizardStepResult] = []
        completed_step_titles: list[str] = []

        if completed_step_ids:
            stmt = select(MaintenanceStep).where(
                col(MaintenanceStep.id).in_(completed_step_ids),
                MaintenanceStep.device_id == payload.device_id,
            )
            result = await session.exec(stmt)
            db_steps = list(result.all())

            if len(db_steps) != len(completed_step_ids):
                found_ids = {s.id for s in db_steps}
                missing = [sid for sid in completed_step_ids if sid not in found_ids]
                raise WizardValidationError(f"Step IDs not found for device {payload.device_id}: {missing}")

            for step in db_steps:
                assert step.id is not None
                wizard_entry = completed_step_map[step.id]
                if wizard_entry.comment is not None:
                    step.description = wizard_entry.comment
                if wizard_entry.supply_item_override is not None:
                    step.supply_item = wizard_entry.supply_item_override

                step.last_completed = today.isoformat()
                step.supply_needed_date = add_months(today, step.recurrence).isoformat()

                session.add(step)
                completed_step_titles.append(step.title)
                updated_step_results.append(
                    WizardStepResult(
                        step_id=step.id,
                        title=step.title,
                        last_completed=step.last_completed,
                        supply_needed_date=step.supply_needed_date,
                    )
                )

        event = ServiceHistoryEvent(
            date=today.isoformat(),
            performer=payload.performer,
            notes=payload.session_notes,
            device_id=payload.device_id,
            completed_steps=completed_step_titles,
        )
        session.add(event)

        await session.commit()
        await session.refresh(event)
        await session.refresh(device)
        assert event.id is not None
        assert device.id is not None

        forwarded_count = 0
        if payload.supply_items_to_order:
            try:
                await TaskService.forward_supplies_to_shopping(payload.supply_items_to_order)
                forwarded_count = len(payload.supply_items_to_order)
            except Exception as exc:
                logger.error("Unexpected error in shopping bridge during wizard submit: %s", exc)

        return WizardSessionResult(
            history_event_id=event.id,
            device_id=device.id,
            device_name=device.name,
            performer=event.performer,
            session_date=event.date,
            completed_step_count=len(completed_step_titles),
            updated_steps=updated_step_results,
            shopping_items_forwarded=forwarded_count,
        )

    @staticmethod
    async def get_maintenance_summary(
        session: AsyncSession,
        household_id: int | None = None,
    ) -> list[HouseholdMaintenanceSummary]:
        """Aggregate device maintenance health states into a household-level dashboard summary."""
        household_stmt = select(Household)
        if household_id is not None:
            household_stmt = household_stmt.where(Household.id == household_id)
        household_result = await session.exec(household_stmt)
        households = list(household_result.all())

        device_stmt = select(Device).options(selectinload(cast(Any, Device.steps)))
        if household_id is not None:
            device_stmt = device_stmt.where(Device.household_id == household_id)
        device_result = await session.exec(device_stmt)
        all_devices = list(device_result.all())

        devices_by_household: dict[int, list[Device]] = {}
        for device in all_devices:
            devices_by_household.setdefault(device.household_id, []).append(device)

        summaries: list[HouseholdMaintenanceSummary] = []

        for household in households:
            assert household.id is not None
            household_devices = devices_by_household.get(household.id, [])
            device_summaries: list[MaintenanceSummary] = []
            total_overdue = 0
            total_due_soon = 0
            total_ok = 0

            for device in household_devices:
                assert device.id is not None
                overdue = 0
                due_soon = 0
                ok = 0
                earliest_date: str | None = None

                for step in device.steps:
                    days = days_until(step.supply_needed_date)
                    if days < 0:
                        overdue += 1
                    elif days <= 14:
                        due_soon += 1
                    else:
                        ok += 1

                    if step.supply_needed_date:
                        if earliest_date is None or step.supply_needed_date < earliest_date:
                            earliest_date = step.supply_needed_date

                total_overdue += overdue
                total_due_soon += due_soon
                total_ok += ok

                device_summaries.append(
                    MaintenanceSummary(
                        device_id=device.id,
                        device_name=device.name,
                        device_location=device.location,
                        total_steps=len(device.steps),
                        overdue_steps=overdue,
                        due_soon_steps=due_soon,
                        ok_steps=ok,
                        next_service_date=earliest_date,
                    )
                )

            summaries.append(
                HouseholdMaintenanceSummary(
                    household_id=household.id,
                    household_name=household.name,
                    total_devices=len(household_devices),
                    total_overdue=total_overdue,
                    total_due_soon=total_due_soon,
                    total_ok=total_ok,
                    devices=device_summaries,
                )
            )

        return summaries
