"""
FastMCP tool definitions for the maintenance orchestration feature.

Registers tools directly to the central FastMCP server instance, consuming logic
exclusively from MaintenanceService.
"""

from typing import Any

from app.core.database import async_session_factory
from app.core.mcp import mcp_server
from app.features.maintenance.service import MaintenanceService


@mcp_server.tool()
async def get_maintenance_summary_tool(household_id: int) -> dict[str, Any]:
    """Retrieve an aggregate maintenance health summary for devices in a target household.

    Args:
        household_id: Integer ID of the household to filter by.
    """
    try:
        async with async_session_factory() as session:
            summaries = await MaintenanceService.get_maintenance_summary(session, household_id=household_id)

        return {
            "total_households": len(summaries),
            "summaries": [s.model_dump() for s in summaries],
        }
    except Exception as e:
        return {"error": f"Failed to calculate maintenance summary: {str(e)}"}
