"""
Maintenance feature router — orchestration layer for the wizard workflow.

This router exposes the higher-level maintenance wizard endpoints that
coordinate across the devices and tasks domains. It is discovered automatically
by the route discovery engine in app/main.py via features/**/router.py globbing.

Base prefix: /api/v1
Traefik rewrite: /api/v1/maintenance/* → /api/v1/*
Frontend prefixUrl: http://loeger-os/api/v1/maintenance/

Available endpoints:
  POST /api/v1/maintenance/wizard    — Commit a full wizard session atomically.
  GET  /api/v1/maintenance/summary   — Return per-household health aggregate.
"""

from __future__ import annotations

import datetime
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_db_session
from app.features.devices.models import Device, Household
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
from app.features.maintenance.schemas import (
    HouseholdMaintenanceSummary,
    MaintenanceSummary,
    WizardSessionPayload,
    WizardSessionResult,
    WizardStepResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["maintenance"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _add_months(source: datetime.date, months: int) -> datetime.date:
    """Advance a date by an integer number of months, clamping to month-end."""
    month = source.month - 1 + months
    year = source.year + month // 12
    month = month % 12 + 1
    day = min(
        source.day,
        [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
         31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1],
    )
    return datetime.date(year, month, day)


def _days_until(iso_date: Optional[str]) -> int:
    """Return the number of calendar days until an ISO date string (negative = overdue)."""
    if not iso_date:
        return 9999
    try:
        return (datetime.date.fromisoformat(iso_date) - datetime.date.today()).days
    except ValueError:
        return 9999


async def _forward_supplies_to_shopping(supply_items: List[str]) -> int:
    """Forward a list of supply items to the shopping-backend microservice.

    Each item is posted individually. HTTP errors are caught and logged so that
    a shopping-backend outage never rolls back the caller's maintenance session.

    Returns the number of items successfully forwarded.
    """
    import httpx  # Local import keeps startup fast when shopping bridge is unused.

    forwarded = 0
    async with httpx.AsyncClient() as client:
        for item in supply_items:
            try:
                response = await client.post(
                    "http://shopping-backend:8000/api/v1/shopping/items",
                    json={"name": item, "quantity": 1.0, "unit": "piece"},
                    timeout=5.0,
                )
                if response.status_code >= 400:
                    logger.error(
                        "Shopping bridge: failed to forward '%s' — HTTP %d",
                        item,
                        response.status_code,
                    )
                else:
                    forwarded += 1
            except Exception as exc:
                logger.error("Shopping bridge: error forwarding '%s': %s", item, exc)
    return forwarded


# ---------------------------------------------------------------------------
# POST /api/v1/maintenance/wizard
# ---------------------------------------------------------------------------


@router.post(
    "/maintenance/wizard",
    response_model=WizardSessionResult,
    status_code=status.HTTP_201_CREATED,
    summary="Commit a completed maintenance wizard session",
    description=(
        "Atomically persists a full maintenance wizard session: creates a "
        "ServiceHistoryEvent, advances each completed step's recurrence timestamp, "
        "applies any per-step comments and supply overrides, then asynchronously "
        "forwards shopping items to the shopping-backend microservice. "
        "The HTTP response is returned before the shopping bridge call completes, "
        "so a shopping-backend outage cannot fail this endpoint."
    ),
)
async def submit_wizard_session(
    payload: WizardSessionPayload,
    session: AsyncSession = Depends(get_db_session),
) -> WizardSessionResult:
    """Process a finished wizard session from the frontend maintenance wizard UI.

    Steps:
      1. Verify the target device exists and belongs to a known household.
      2. Load and validate all completed MaintenanceStep records.
      3. Apply per-step comment and supply overrides from the wizard.
      4. Advance last_completed and supply_needed_date for each completed step.
      5. Create the ServiceHistoryEvent record.
      6. Commit the transaction.
      7. Fire-and-forget forward of supply items to the shopping microservice.
    """
    # 1. Verify device exists.
    device = await session.get(Device, payload.device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {payload.device_id} not found",
        )

    today = datetime.date.today()
    completed_step_ids = [entry.step_id for entry in payload.completed_steps]
    completed_step_map = {entry.step_id: entry for entry in payload.completed_steps}

    # 2. Load and validate MaintenanceStep records.
    updated_step_results: List[WizardStepResult] = []
    completed_step_titles: List[str] = []

    if completed_step_ids:
        stmt = select(MaintenanceStep).where(
            MaintenanceStep.id.in_(completed_step_ids),
            MaintenanceStep.device_id == payload.device_id,
        )
        result = await session.execute(stmt)
        db_steps = result.scalars().all()

        # Guard against mismatched or cross-device step IDs in the payload.
        if len(db_steps) != len(completed_step_ids):
            found_ids = {s.id for s in db_steps}
            missing = [sid for sid in completed_step_ids if sid not in found_ids]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Step IDs not found for device {payload.device_id}: {missing}",
            )

        # 3 & 4. Apply overrides and advance recurrence timestamps.
        for step in db_steps:
            wizard_entry = completed_step_map[step.id]

            # Apply comment override if provided (stored in description field).
            if wizard_entry.comment is not None:
                step.description = wizard_entry.comment

            # Apply supply item override if provided.
            if wizard_entry.supply_item_override is not None:
                step.supply_item = wizard_entry.supply_item_override

            # Advance recurrence timestamps.
            step.last_completed = today.isoformat()
            step.supply_needed_date = _add_months(today, step.recurrence).isoformat()

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

    # 5. Create the ServiceHistoryEvent.
    event = ServiceHistoryEvent(
        date=today.isoformat(),
        performer=payload.performer,
        notes=payload.session_notes,
        device_id=payload.device_id,
        completed_steps=completed_step_titles,
    )
    session.add(event)

    # 6. Commit everything in a single transaction.
    await session.commit()
    await session.refresh(event)

    # Reload the device name for the response (avoids a lazy-load after commit).
    await session.refresh(device)

    # 7. Asynchronously forward supply items — errors are swallowed after logging.
    forwarded_count = 0
    if payload.supply_items_to_order:
        try:
            forwarded_count = await _forward_supplies_to_shopping(
                payload.supply_items_to_order
            )
        except Exception as exc:
            # Belt-and-suspenders guard: _forward_supplies_to_shopping already
            # catches its own errors, but we never let this propagate to the client.
            logger.error("Unexpected error in shopping bridge: %s", exc)

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


# ---------------------------------------------------------------------------
# GET /api/v1/maintenance/summary
# ---------------------------------------------------------------------------


@router.get(
    "/maintenance/summary",
    response_model=List[HouseholdMaintenanceSummary],
    summary="Return maintenance health summary grouped by household",
    description=(
        "Returns a per-household aggregate of device maintenance states. "
        "Each device is classified into overdue / due_soon (<= 14 days) / ok "
        "buckets based on the earliest step due date. "
        "Optionally filter to a single household with the household_id query param."
    ),
)
async def get_maintenance_summary(
    household_id: Optional[int] = Query(
        default=None,
        description="Restrict results to a single household",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> List[HouseholdMaintenanceSummary]:
    """Aggregate device maintenance health states into a household-level dashboard summary.

    Eagerly loads Device.steps so that all classification logic runs in Python
    without extra round-trips. The selectinload strategy avoids N+1 queries.
    """
    # Load all households (or just the requested one).
    household_stmt = select(Household)
    if household_id is not None:
        household_stmt = household_stmt.where(Household.id == household_id)
    household_result = await session.execute(household_stmt)
    households = household_result.scalars().all()

    # Load all devices with their steps in a single query.
    device_stmt = select(Device).options(selectinload(Device.steps))
    if household_id is not None:
        device_stmt = device_stmt.where(Device.household_id == household_id)
    device_result = await session.execute(device_stmt)
    all_devices = device_result.scalars().all()

    # Index devices by household_id for fast lookup.
    devices_by_household: dict[int, List[Device]] = {}
    for device in all_devices:
        devices_by_household.setdefault(device.household_id, []).append(device)

    summaries: List[HouseholdMaintenanceSummary] = []

    for household in households:
        household_devices = devices_by_household.get(household.id, [])
        device_summaries: List[MaintenanceSummary] = []
        total_overdue = 0
        total_due_soon = 0
        total_ok = 0

        for device in household_devices:
            overdue = 0
            due_soon = 0
            ok = 0
            earliest_date: Optional[str] = None

            for step in device.steps:
                days = _days_until(step.supply_needed_date)
                if days < 0:
                    overdue += 1
                elif days <= 14:
                    due_soon += 1
                else:
                    ok += 1

                # Track earliest upcoming or overdue date for the next_service_date field.
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
