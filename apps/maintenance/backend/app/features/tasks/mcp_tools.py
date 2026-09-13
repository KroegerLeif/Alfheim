"""
FastMCP tool definitions for the tasks feature.

Registers tools directly to the central FastMCP server instance, consuming logic
exclusively from TaskService.
"""

import datetime
from typing import Any

from backend_shared.mcp_middleware import get_mcp_user_context
from app.core.database import async_session_factory
from app.core.mcp import mcp_server
from app.features.tasks.exceptions import TaskError
from app.features.tasks.schemas import TaskStateUpdate
from app.features.tasks.service import TaskService


@mcp_server.tool()
async def list_overdue_tasks() -> dict[str, Any]:
    """Return all maintenance steps that are currently overdue for the authenticated household.

    Returns:
        Structured dictionary with total overdue count and detailed list of tasks.
    """
    try:
        user_context = get_mcp_user_context()
        if not user_context.household_id:
            return {"error": "No household context available"}

        async with async_session_factory() as session:
            tasks = await TaskService.get_overdue_tasks(session, household_id=user_context.household_id)

        return {
            "as_of": datetime.date.today().isoformat(),
            "total_overdue": len(tasks),
            "tasks": tasks,
        }
    except RuntimeError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Failed to list overdue tasks: {str(e)}"}


@mcp_server.tool()
async def update_task_state_tool(
    step_id: int,
    comment: str | None = None,
    supply_needed_date: str | None = None,
    supply_item: str | None = None,
) -> dict[str, Any]:
    """Update a specific maintenance step's inspection note, due date, or supply item, enforcing household isolation.

    Args:
        step_id: The integer ID of the target MaintenanceStep.
        comment: Optional inspection note or description override.
        supply_needed_date: Optional YYYY-MM-DD next due date string.
        supply_item: Optional replacement supply item description.
    """
    try:
        user_context = get_mcp_user_context()
        if not user_context.household_id:
            return {"success": False, "error": "No household context available"}

        payload = TaskStateUpdate(
            comment=comment,
            supply_needed_date=supply_needed_date,
            supply_item=supply_item,
        )
        async with async_session_factory() as session:
            step = await TaskService.update_task_state(
                session, step_id, payload, household_id=user_context.household_id
            )

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
    except RuntimeError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}
