"""
FastMCP tool definitions for the tasks feature.

Registers tools directly to the central FastMCP server instance, consuming logic
exclusively from TaskService.
"""

import datetime
from typing import Any

from app.core.database import async_session_factory
from app.core.mcp import mcp_server
from app.features.tasks.exceptions import TaskError
from app.features.tasks.schemas import TaskStateUpdate
from app.features.tasks.service import TaskService


@mcp_server.tool()
async def list_overdue_tasks(household_id: int) -> dict[str, Any]:
    """Return all maintenance steps that are currently overdue for a specific household.

    Args:
        household_id: Integer ID of the household to filter by.

    Returns:
        Structured dictionary with total overdue count and detailed list of tasks.
    """
    try:
        async with async_session_factory() as session:
            tasks = await TaskService.get_overdue_tasks(session, household_id=household_id)

        return {
            "as_of": datetime.date.today().isoformat(),
            "total_overdue": len(tasks),
            "tasks": tasks,
        }
    except Exception as e:
        return {"error": f"Failed to list overdue tasks: {str(e)}"}


@mcp_server.tool()
async def update_task_state_tool(
    household_id: int,
    step_id: int,
    comment: str | None = None,
    supply_needed_date: str | None = None,
    supply_item: str | None = None,
) -> dict[str, Any]:
    """Update a specific maintenance step's inspection note, due date, or supply item, enforcing household isolation.

    Args:
        household_id: Integer ID of the household space.
        step_id: The integer ID of the target MaintenanceStep.
        comment: Optional inspection note or description override.
        supply_needed_date: Optional YYYY-MM-DD next due date string.
        supply_item: Optional replacement supply item description.
    """
    try:
        payload = TaskStateUpdate(
            comment=comment,
            supply_needed_date=supply_needed_date,
            supply_item=supply_item,
        )
        async with async_session_factory() as session:
            step = await TaskService.update_task_state(session, step_id, payload, household_id=household_id)

        return {
            "success": True,
            "step_id": step.id,
            "title": step.title,
            "description": step.description,
            "supply_needed_date": step.supply_needed_date,
            "supply_item": step.supply_item,
        }
    except TaskError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}
