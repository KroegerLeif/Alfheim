import uuid

from backend_shared.mcp_middleware import get_mcp_household_context
from src.core.database import async_session_factory
from src.features.plans import service
from src.features.plans.schemas import PlanCreate
from src.mcp.server import mcp


@mcp.tool()
async def list_plans(limit: int = 100, offset: int = 0) -> str:
    """List workout plans visible to the caller: their own plus any shared within their household."""
    try:
        context = get_mcp_household_context()
        home_uuid = context.household_id
        user_uuid = context.user_id
        async with async_session_factory() as session:
            plans = await service.list_plans(session, home_uuid, user_uuid, limit, offset)
            if not plans:
                return "No plans found."
            lines = [f"- {p.name} (ID: {p.id}, {len(p.days)} day(s), shared: {p.is_shared})" for p in plans]
            return "\n".join(lines)
    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to list plans: {str(e)}"


@mcp.tool()
async def get_plan(plan_id: str) -> str:
    """Retrieve a plan's full day/exercise/set structure.

    Parameters:
    - plan_id: UUID string of the plan.
    """
    try:
        context = get_mcp_household_context()
        home_uuid = context.household_id
        user_uuid = context.user_id
        plan_uuid = uuid.UUID(plan_id)
        async with async_session_factory() as session:
            plan = await service.get_plan(session, plan_uuid, home_uuid, user_uuid)
            if not plan:
                return f"Plan with ID {plan_id} not found or not authorized."
            lines = [f"Plan: {plan.name} (shared: {plan.is_shared})"]
            for day in plan.days:
                lines.append(f"  Day {day.day_order + 1}: {day.label}")
                for pe in day.exercises:
                    lines.append(f"    Exercise {pe.exercise_id}: {len(pe.sets)} set(s)")
            return "\n".join(lines)
    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to retrieve plan: {str(e)}"


@mcp.tool()
async def create_plan(
    name: str,
    description: str | None = None,
    is_shared: bool = False,
) -> str:
    """Create a new empty workout plan (days/exercises/sets are added via separate tools/endpoints).

    Parameters:
    - name: Plan name.
    - description: Optional description.
    - is_shared: Whether the plan is visible to the whole household.
    """
    try:
        context = get_mcp_household_context()
        home_uuid = context.household_id
        user_uuid = context.user_id
        payload = PlanCreate(name=name, description=description, is_shared=is_shared)
        async with async_session_factory() as session:
            plan = await service.create_plan(session, payload, home_uuid, user_uuid)
            return f"Success: Created plan '{plan.name}' with ID {plan.id}."
    except ValueError as e:
        return f"Error: Failed to create plan: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def delete_plan(plan_id: str) -> str:
    """Delete a plan. Only the owner may delete it.

    Parameters:
    - plan_id: UUID string of the plan to delete.
    """
    try:
        context = get_mcp_household_context()
        home_uuid = context.household_id
        user_uuid = context.user_id
        plan_uuid = uuid.UUID(plan_id)
        async with async_session_factory() as session:
            deleted = await service.delete_plan(session, plan_uuid, home_uuid, user_uuid)
            if not deleted:
                return f"Plan with ID {plan_id} not found or not authorized."
            return f"Success: Deleted plan {plan_id}."
    except ValueError as e:
        return f"Error: Deletion failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
