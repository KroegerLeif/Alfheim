"""
FastMCP tool definitions for the devices feature.

Registers tools directly to the central FastMCP server instance, consuming logic
exclusively from DeviceService.
"""

import datetime
from typing import Any, Optional
from app.core.mcp import mcp_server
from app.core.database import async_session_factory
from app.features.devices.service import DeviceService
from app.features.devices.exceptions import DeviceError


@mcp_server.tool()
async def get_device_status(device_name: str) -> dict[str, Any]:
    """Return the active health state, notes, and outstanding tasks for a named device.

    Args:
        device_name: Full or partial name of the device to look up.

    Returns:
        Structured dictionary containing status, location, notes, and step summaries.
    """
    try:
        async with async_session_factory() as session:
            all_devices = await DeviceService.get_devices(session)

        # Filter by name matching (case-insensitive partial match)
        matching = [
            d for d in all_devices if device_name.lower() in d.name.lower()
        ]

        if not matching:
            return {
                "found": False,
                "message": f"No device matching '{device_name}' was found in the database.",
            }

        today = datetime.date.today()
        output = []

        for device in matching:
            overdue_steps = []
            upcoming_steps = []

            for step in device.steps:
                due_date = step.supply_needed_date
                if due_date:
                    try:
                        days_remaining = (
                            datetime.date.fromisoformat(due_date) - today
                        ).days
                    except ValueError:
                        days_remaining = 9999

                    entry = {
                        "step_id": step.id,
                        "title": step.title,
                        "due_date": due_date,
                        "days_remaining": days_remaining,
                        "supply_item": step.supply_item,
                    }
                    if days_remaining < 0:
                        overdue_steps.append(entry)
                    else:
                        upcoming_steps.append(entry)

            output.append({
                "id": device.id,
                "name": device.name,
                "model": device.model,
                "serial": device.serial,
                "category": device.category,
                "location": device.location,
                "status": device.status,
                "notes": device.notes,
                "overdue_steps": overdue_steps,
                "upcoming_steps": upcoming_steps,
                "total_steps": len(device.steps),
            })

        return {
            "found": True,
            "query": device_name,
            "as_of": today.isoformat(),
            "devices": output,
        }
    except Exception as e:
        return {"found": False, "error": f"Failed to retrieve device status: {str(e)}"}


@mcp_server.tool()
async def list_devices(household_id: Optional[int] = None) -> dict[str, Any]:
    """Retrieve all registered devices, optionally filtered by household.

    Args:
        household_id: Optional integer ID of the household to filter by.
    """
    try:
        async with async_session_factory() as session:
            devices = await DeviceService.get_devices(session, household_id=household_id)

        results = [
            {
                "id": d.id,
                "name": d.name,
                "model": d.model,
                "category": d.category,
                "location": d.location,
                "status": d.status,
                "household_id": d.household_id,
                "step_count": len(d.steps),
            }
            for d in devices
        ]
        return {"total": len(results), "devices": results}
    except Exception as e:
        return {"error": f"Failed to list devices: {str(e)}"}


@mcp_server.tool()
async def get_device_detail(device_id: int) -> dict[str, Any]:
    """Fetch complete metadata and steps for a specific device by ID.

    Args:
        device_id: The primary key integer ID of the target device.
    """
    try:
        async with async_session_factory() as session:
            device = await DeviceService.get_device_by_id(session, device_id=device_id)

        return {
            "id": device.id,
            "name": device.name,
            "model": device.model,
            "serial": device.serial,
            "category": device.category,
            "location": device.location,
            "status": device.status,
            "service_interval_months": device.service_interval_months,
            "notes": device.notes,
            "household_id": device.household_id,
            "steps": [
                {
                    "id": s.id,
                    "title": s.title,
                    "recurrence_months": s.recurrence,
                    "supply_item": s.supply_item,
                    "supply_needed_date": s.supply_needed_date,
                    "last_completed": s.last_completed,
                }
                for s in device.steps
            ],
            "history_count": len(device.history_events),
        }
    except DeviceError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
