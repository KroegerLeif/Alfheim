"""
FastMCP tool definitions for the maintenance orchestration feature.

Registers tools directly to the central FastMCP server instance, consuming logic
exclusively from MaintenanceService.
"""

from typing import Any

from backend_shared.mcp_middleware import get_mcp_household_context

from app.core.database import async_session_factory
from app.core.mcp import mcp_server
from app.features.maintenance.service import MaintenanceService


@mcp_server.tool()
async def get_maintenance_summary_tool() -> dict[str, Any]:
    """Retrieve an aggregate maintenance health summary for devices in the authenticated household."""
    try:
        user_context = get_mcp_household_context()

        async with async_session_factory() as session:
            summaries = await MaintenanceService.get_maintenance_summary(
                session, household_id=user_context.household_id
            )

        return {
            "total_households": len(summaries),
            "summaries": [s.model_dump(mode="json") for s in summaries],
        }
    except RuntimeError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Failed to calculate maintenance summary: {str(e)}"}
