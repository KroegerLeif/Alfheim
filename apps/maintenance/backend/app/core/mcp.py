"""
MCP (Model Context Protocol) server for the Maintenance OS backend.

Exposes AI tools that allow agents to query live device health states
and enumerate overdue maintenance tasks directly from the PostgreSQL database.
Mounted into the main FastAPI app under /api/v1/mcp via SSE transport.
"""

import datetime
import logging
from typing import Any

from mcp.server.fastmcp import FastMCP
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.features.devices.models import Device
from app.features.tasks.models import MaintenanceStep
from app.core.database import async_session_factory

logger = logging.getLogger(__name__)

# Initialize the FastMCP server instance
mcp_server = FastMCP("Maintenance OS Ingress")


@mcp_server.tool()
async def get_device_status(device_name: str) -> dict[str, Any]:
    """Return the active health state, notes, and outstanding tasks for a named device.

    Args:
        device_name: The full or partial name of the device to look up.

    Returns:
        A structured dict containing device status, notes, and step summaries.
    """
    async with async_session_factory() as session:
        # Case-insensitive partial match on device name
        statement = (
            select(Device)
            .options(selectinload(Device.steps))
            .where(Device.name.ilike(f"%{device_name}%"))
        )
        result = await session.execute(statement)
        devices = result.scalars().all()

    if not devices:
        return {
            "found": False,
            "message": f"No device matching '{device_name}' was found in the database.",
        }

    today = datetime.date.today().isoformat()
    output = []

    for device in devices:
        overdue_steps = []
        upcoming_steps = []

        for step in device.steps:
            due_date = step.supply_needed_date
            if due_date:
                days_remaining = (
                    datetime.date.fromisoformat(due_date) - datetime.date.today()
                ).days
                entry = {
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
        "as_of": today,
        "devices": output,
    }


@mcp_server.tool()
async def list_overdue_tasks() -> dict[str, Any]:
    """Return all maintenance steps that are currently overdue across all devices.

    A step is considered overdue when its supply_needed_date is earlier than today.

    Returns:
        A structured dict with the total overdue count and a detailed list of tasks.
    """
    async with async_session_factory() as session:
        statement = (
            select(MaintenanceStep)
            .options(selectinload(MaintenanceStep.device))
        )
        result = await session.execute(statement)
        all_steps = result.scalars().all()

    today = datetime.date.today()
    overdue = []

    for step in all_steps:
        if not step.supply_needed_date:
            continue
        due = datetime.date.fromisoformat(step.supply_needed_date)
        if due < today:
            days_overdue = (today - due).days
            overdue.append({
                "step_id": step.id,
                "title": step.title,
                "device_id": step.device_id,
                "device_name": step.device.name if step.device else "Unknown",
                "device_location": step.device.location if step.device else "Unknown",
                "due_date": step.supply_needed_date,
                "days_overdue": days_overdue,
                "supply_item": step.supply_item,
                "last_completed": step.last_completed,
            })

    # Sort by most overdue first
    overdue.sort(key=lambda x: x["days_overdue"], reverse=True)

    return {
        "as_of": today.isoformat(),
        "total_overdue": len(overdue),
        "tasks": overdue,
    }
