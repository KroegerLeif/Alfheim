import uuid

from src.core.database import async_session_factory
from src.features.plans import service
from src.features.plans.schemas import PlanCreate
from src.mcp.server import mcp


@mcp.tool()
async def list_plans(household_id: str, user_id: str, limit: int = 100, offset: int = 0) -> str:
    """List workout plans visible to the caller: their own plus any shared within their household.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
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
async def get_plan(household_id: str, user_id: str, plan_id: str) -> str:
    """Retrieve a plan's full day/exercise/set structure.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - plan_id: UUID string of the plan.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
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
    household_id: str,
    user_id: str,
    name: str,
    description: str | None = None,
    is_shared: bool = False,
) -> str:
    """Create a new empty workout plan (days/exercises/sets are added via separate tools/endpoints).

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - name: Plan name.
    - description: Optional description.
    - is_shared: Whether the plan is visible to the whole household.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        payload = PlanCreate(name=name, description=description, is_shared=is_shared)
        async with async_session_factory() as session:
            plan = await service.create_plan(session, payload, home_uuid, user_uuid)
            return f"Success: Created plan '{plan.name}' with ID {plan.id}."
    except ValueError as e:
        return f"Error: Failed to create plan: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def delete_plan(household_id: str, user_id: str, plan_id: str) -> str:
    """Delete a plan. Only the owner may delete it.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - plan_id: UUID string of the plan to delete.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
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
