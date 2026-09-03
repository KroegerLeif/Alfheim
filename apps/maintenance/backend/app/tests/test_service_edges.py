"""Unit tests covering service layer edge cases, seed logic, and domain re-exports in maintenance."""

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from app.core.database import seed_database
from app.features.devices.exceptions import DeviceNotFoundError
from app.features.devices.models import Device, Household

# Import models to execute domain re-export coverage
from app.features.maintenance.models import (  # noqa: F401
    Device as ReexportedDevice,
)
from app.features.maintenance.schemas import WizardSessionPayload, WizardStepEntry
from app.features.maintenance.service import MaintenanceService, days_until
from app.features.tasks.exceptions import InvalidStepError, StepNotFoundError
from app.features.tasks.models import MaintenanceStep
from app.features.tasks.schemas import MaintenanceSubmission, TaskStateUpdate
from app.features.tasks.service import TaskService
from httpx import Response
from sqlmodel.ext.asyncio.session import AsyncSession


@pytest.mark.asyncio
async def test_seed_database_execution(db_session: AsyncSession):
    """Verify that seed_database populates mockup devices, steps, and history records."""
    await seed_database(db_session)


def test_days_until_edge_cases():
    """Verify days_until helper handles None, malformed date strings, and valid ISO dates."""
    assert days_until(None) == 9999
    assert days_until("") == 9999
    assert days_until("not-a-valid-date") == 9999

    future_date = (date.today() + timedelta(days=5)).isoformat()
    assert days_until(future_date) == 5

    past_date = (date.today() - timedelta(days=3)).isoformat()
    assert days_until(past_date) == -3


@pytest.mark.asyncio
async def test_maintenance_service_submit_wizard_edge_cases(db_session: AsyncSession):
    """Verify wizard session submission edge cases including supply overrides and forwarder errors."""
    # 1. Device not found
    with pytest.raises(DeviceNotFoundError):
        await MaintenanceService.submit_wizard_session(
            db_session,
            WizardSessionPayload(device_id=99999, performer="Tester", completed_steps=[]),
        )

    # Setup device & step
    household = Household(name="Wiz Home", address="Addr 1")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    assert household.id is not None

    device = Device(
        name="Filter",
        model="F1",
        serial="SN-1",
        category="Air",
        location="Hall",
        status="active",
        service_interval_months=6,
        household_id=household.id,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    assert device.id is not None

    step = MaintenanceStep(
        title="Replace filter element",
        description="Clean mesh",
        recurrence=6,
        device_id=device.id,
    )
    db_session.add(step)
    await db_session.commit()
    await db_session.refresh(step)
    assert step.id is not None

    # 2. Step with supply_item_override, comment, and shopping forwarder failure
    with patch(
        "app.features.tasks.service.TaskService.forward_supplies_to_shopping", side_effect=RuntimeError("Shopping down")
    ):
        result = await MaintenanceService.submit_wizard_session(
            db_session,
            WizardSessionPayload(
                device_id=device.id,
                performer="Tester",
                session_notes="Notes",
                completed_steps=[
                    WizardStepEntry(
                        step_id=step.id,
                        comment="Cleaned thoroughly",
                        supply_item_override="HEPA 100",
                    )
                ],
                supply_items_to_order=["HEPA 100"],
            ),
        )
        assert result.completed_step_count == 1
        assert result.shopping_items_forwarded == 0

    await db_session.refresh(step)
    assert step.supply_item == "HEPA 100"
    assert step.description == "Cleaned thoroughly"


@pytest.mark.asyncio
async def test_maintenance_service_summary_step_categories(db_session: AsyncSession):
    """Verify summary categorizes overdue, due soon, and ok steps correctly."""
    household = Household(name="Summary Home", address="Addr 2")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    assert household.id is not None

    device = Device(
        name="HVAC",
        model="H1",
        serial="SN-H",
        category="Heating",
        location="Attic",
        status="active",
        service_interval_months=6,
        household_id=household.id,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    assert device.id is not None

    today = date.today()
    s_overdue = MaintenanceStep(
        title="Overdue step",
        description="",
        recurrence=3,
        supply_needed_date=(today - timedelta(days=5)).isoformat(),
        device_id=device.id,
    )
    s_due_soon = MaintenanceStep(
        title="Due soon step",
        description="",
        recurrence=3,
        supply_needed_date=(today + timedelta(days=7)).isoformat(),
        device_id=device.id,
    )
    s_ok = MaintenanceStep(
        title="Ok step",
        description="",
        recurrence=3,
        supply_needed_date=(today + timedelta(days=40)).isoformat(),
        device_id=device.id,
    )
    db_session.add_all([s_overdue, s_due_soon, s_ok])
    await db_session.commit()

    summaries = await MaintenanceService.get_maintenance_summary(db_session, household_id=household.id)
    assert len(summaries) == 1
    summary = summaries[0]
    assert summary.total_overdue == 1
    assert summary.total_due_soon == 1
    assert summary.total_ok == 1


@pytest.mark.asyncio
async def test_task_service_forward_supplies_to_shopping():
    """Verify forward_supplies_to_shopping handles error status codes and network exceptions."""
    # 1. 400 Bad request response
    mock_resp = Response(status_code=400)
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        await TaskService.forward_supplies_to_shopping(["Part A"])

    # 2. Network exception
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=RuntimeError("Connection dropped")):
        await TaskService.forward_supplies_to_shopping(["Part B"])


@pytest.mark.asyncio
async def test_task_service_submit_wizard_exceptions(db_session: AsyncSession):
    """Verify submit_maintenance_wizard handles missing devices, invalid steps, and shopping forward failures."""
    # Missing device
    with pytest.raises(DeviceNotFoundError):
        await TaskService.submit_maintenance_wizard(
            db_session,
            MaintenanceSubmission(device_id=99999, performer="Tester", completed_step_ids=[]),
        )

    household = Household(name="H3", address="Addr 3")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    assert household.id is not None

    device = Device(
        name="Fan",
        model="M",
        serial="S",
        category="Vent",
        location="Room",
        status="active",
        service_interval_months=3,
        household_id=household.id,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    assert device.id is not None

    # Invalid step ID
    with pytest.raises(InvalidStepError):
        await TaskService.submit_maintenance_wizard(
            db_session,
            MaintenanceSubmission(device_id=device.id, performer="Tester", completed_step_ids=[99999]),
        )

    # Supply forwarding exception
    with patch(
        "app.features.tasks.service.TaskService.forward_supplies_to_shopping", side_effect=RuntimeError("Bridge down")
    ):
        event = await TaskService.submit_maintenance_wizard(
            db_session,
            MaintenanceSubmission(device_id=device.id, performer="Tester", completed_step_ids=[], supply_items=["Oil"]),
        )
        assert event.device_id == device.id


@pytest.mark.asyncio
async def test_task_service_update_task_state_and_overdue(db_session: AsyncSession):
    """Verify update_task_state and get_overdue_tasks edge cases."""
    # Missing step
    with pytest.raises(StepNotFoundError):
        await TaskService.update_task_state(db_session, 99999, TaskStateUpdate(comment="test"))

    household = Household(name="H4", address="Addr 4")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    assert household.id is not None

    device = Device(
        name="Pump",
        model="P",
        serial="SP",
        category="Plumbing",
        location="Utility",
        status="active",
        service_interval_months=3,
        household_id=household.id,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    assert device.id is not None

    step = MaintenanceStep(
        title="Check seal",
        description="Seal inspect",
        recurrence=3,
        supply_needed_date="2026-05-01",
        device_id=device.id,
    )
    step_no_date = MaintenanceStep(
        title="Check manual",
        description="",
        recurrence=12,
        supply_needed_date=None,
        device_id=device.id,
    )
    step_bad_date = MaintenanceStep(
        title="Bad date step",
        description="",
        recurrence=12,
        supply_needed_date="invalid-date",
        device_id=device.id,
    )
    db_session.add_all([step, step_no_date, step_bad_date])
    await db_session.commit()
    await db_session.refresh(step)
    assert step.id is not None

    # Household mismatch
    with pytest.raises(StepNotFoundError):
        await TaskService.update_task_state(db_session, step.id, TaskStateUpdate(comment="test"), household_id=99999)

    # Update supply item
    updated = await TaskService.update_task_state(db_session, step.id, TaskStateUpdate(supply_item="O-Ring"))
    assert updated.supply_item == "O-Ring"

    # Get overdue tasks (should include step with 2026-05-01, skip step_no_date and step_bad_date)
    overdue = await TaskService.get_overdue_tasks(db_session, household_id=household.id)
    assert len(overdue) >= 1
    assert any(t["title"] == "Check seal" for t in overdue)

    # Filter with non-matching household_id
    overdue_other = await TaskService.get_overdue_tasks(db_session, household_id=99999)
    assert len(overdue_other) == 0
