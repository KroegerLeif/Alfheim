"""Integration tests covering edge cases in maintenance, devices, and tasks REST API routers."""

from datetime import date
from unittest.mock import patch

import pytest
from app.features.devices.exceptions import DeviceError
from app.features.devices.models import Device, Household
from app.features.tasks.models import MaintenanceStep
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession


@pytest.mark.asyncio
async def test_device_router_edge_cases(client: AsyncClient, db_session: AsyncSession):
    """Verify device router endpoints for listing, 404 not found, and creation validation errors."""
    household = Household(name="Test Home", address="123 Street")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    assert household.id is not None

    headers = {"X-Household-ID": str(household.id)}

    # 1. GET /api/v1/households
    res_hh = await client.get("/api/v1/households", headers=headers)
    assert res_hh.status_code == 200
    assert any(h["name"] == "Test Home" for h in res_hh.json())

    # 2. GET /api/v1/devices/{device_id} not found
    res_dev_missing = await client.get("/api/v1/devices/99999", headers=headers)
    assert res_dev_missing.status_code == 404

    # 3. POST /api/v1/devices with nonexistent household
    res_create_no_hh = await client.post(
        "/api/v1/devices",
        json={
            "name": "Fridge",
            "model": "Samsung",
            "serial": "SN-123",
            "category": "Appliances",
            "location": "Kitchen",
            "status": "active",
            "service_interval_months": 6,
            "household_id": 99999,
            "steps": [],
        },
        headers=headers,
    )
    assert res_create_no_hh.status_code == 404

    # 4. POST /api/v1/devices with DeviceError simulated
    with patch("app.features.devices.service.DeviceService.create_device", side_effect=DeviceError("Creation failed")):
        res_create_err = await client.post(
            "/api/v1/devices",
            json={
                "name": "Fridge",
                "model": "Samsung",
                "serial": "SN-123",
                "category": "Appliances",
                "location": "Kitchen",
                "status": "active",
                "service_interval_months": 6,
                "household_id": household.id,
                "steps": [],
            },
            headers=headers,
        )
        assert res_create_err.status_code == 400


@pytest.mark.asyncio
async def test_maintenance_wizard_router_edge_cases(client: AsyncClient, db_session: AsyncSession):
    """Verify wizard session router error handling for missing device, invalid steps, and summary query."""
    household = Household(name="Wizard Home", address="456 Avenue")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    assert household.id is not None

    device = Device(
        name="Boiler",
        model="Bosch",
        serial="B-100",
        category="Heating",
        location="Basement",
        status="active",
        service_interval_months=12,
        household_id=household.id,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    assert device.id is not None

    headers = {"X-Household-ID": str(household.id)}

    # 1. Wizard submit with nonexistent device -> 404
    res_wiz_no_dev = await client.post(
        "/api/v1/maintenance/wizard",
        json={
            "device_id": 99999,
            "performer": "Bob",
            "completed_steps": [],
        },
        headers=headers,
    )
    assert res_wiz_no_dev.status_code == 404

    # 2. Wizard submit with invalid step ID -> 400
    res_wiz_invalid_step = await client.post(
        "/api/v1/maintenance/wizard",
        json={
            "device_id": device.id,
            "performer": "Bob",
            "completed_steps": [{"step_id": 88888, "comment": "Done"}],
        },
        headers=headers,
    )
    assert res_wiz_invalid_step.status_code == 400

    # 3. Summary filtered by household_id
    res_summary = await client.get(f"/api/v1/maintenance/summary?household_id={household.id}", headers=headers)
    assert res_summary.status_code == 200
    assert len(res_summary.json()) == 1


@pytest.mark.asyncio
async def test_tasks_router_edge_cases(client: AsyncClient, db_session: AsyncSession):
    """Verify tasks router for submit maintenance, history filter, and step state updates."""
    household = Household(name="Tasks Home", address="789 Blvd")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)
    assert household.id is not None

    device = Device(
        name="Heat Pump",
        model="Viessmann",
        serial="VP-99",
        category="Heating",
        location="Garage",
        status="active",
        service_interval_months=6,
        household_id=household.id,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    assert device.id is not None

    step = MaintenanceStep(
        title="Check pressure gauge",
        description="Inspect dial",
        recurrence=3,
        supply_needed_date=date.today().isoformat(),
        device_id=device.id,
    )
    db_session.add(step)
    await db_session.commit()
    await db_session.refresh(step)
    assert step.id is not None

    headers = {"X-Household-ID": str(household.id)}

    # 1. Submit maintenance with nonexistent device -> 404
    res_submit_no_dev = await client.post(
        "/api/v1/submit",
        json={"device_id": 99999, "performer": "Alice", "completed_step_ids": []},
        headers=headers,
    )
    assert res_submit_no_dev.status_code == 404

    # 2. Submit maintenance with invalid step ID -> 400
    res_submit_bad_step = await client.post(
        "/api/v1/submit",
        json={"device_id": device.id, "performer": "Alice", "completed_step_ids": [99999]},
        headers=headers,
    )
    assert res_submit_bad_step.status_code == 400

    # 3. History filtered by household_id
    res_history = await client.get(f"/api/v1/history?household_id={household.id}", headers=headers)
    assert res_history.status_code == 200

    # 4. Update task state nonexistent step -> 404
    res_state_missing = await client.post(
        "/api/v1/tasks/99999/state",
        json={"comment": "new comment"},
        headers=headers,
    )
    assert res_state_missing.status_code == 404

    # 5. Update task state successful
    res_state_ok = await client.post(
        f"/api/v1/tasks/{step.id}/state",
        json={"comment": "Updated description", "supply_needed_date": "2026-10-01"},
        headers=headers,
    )
    assert res_state_ok.status_code == 200
    assert res_state_ok.json()["description"] == "Updated description"
