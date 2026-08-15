import uuid
from datetime import date

from sqlmodel import select

from src.core.database import async_session_factory
from src.core.dependencies import MOCK_HOME_ID, MOCK_USER_ID
from src.features.chore_management.models import ChoreInstance, ChoreTemplate
from src.features.chore_management.schemas import ChoreAssignRequest
from src.features.chore_management.service import ChoreService
from src.mcp.server import mcp


@mcp.tool()
async def get_daily_chores_overview() -> str:
    """Retrieve an overview of today's chores status (completed, pending, streaks) for the household."""
    try:
        async with async_session_factory() as session:
            summary = await ChoreService.get_integrations_summary(
                session=session,
                home_id=MOCK_HOME_ID,
            )

            lines = [
                f"Household Streak: {summary['current_streak']} days (Longest: {summary['longest_streak']} days)",
                f"Today's Chores Completion: {summary['today_completed_count']}/{summary['today_total_count']} ({summary['completion_rate']}%)",
                "Chores List:",
            ]

            today_chores = summary["today_chores"]
            if not today_chores:
                lines.append("- No chores scheduled for today. Add templates to configure chores!")
            else:
                for inst in today_chores:
                    # Get name from template
                    t_stmt = select(ChoreTemplate).where(ChoreTemplate.id == inst.template_id)
                    t_res = await session.exec(t_stmt)
                    template = t_res.first()
                    name = template.name if template else "Unknown Chore"
                    points = template.points if template else 0

                    assignee = f" (Assigned to: {inst.assigned_to})" if inst.assigned_to else " (Unassigned)"
                    status_marker = "✓" if inst.status == "completed" else "✗"
                    lines.append(f"[{status_marker}] {name} (ID: {inst.id}){assignee} | Points: {points}")

            return "\n".join(lines)

    except Exception as e:
        return f"Error: Failed to fetch daily chores overview: {str(e)}"


@mcp.tool()
async def complete_chore_by_name(chore_name: str) -> str:
    """Complete a pending chore instance by searching for its template name.

    Parameters:
    - chore_name: The name of the chore template (e.g. 'Wash Dishes').
    """
    try:
        async with async_session_factory() as session:
            # 1. Find template first
            t_stmt = select(ChoreTemplate).where(
                ChoreTemplate.home_id == MOCK_HOME_ID,
                ChoreTemplate.name == chore_name,
            )
            t_res = await session.exec(t_stmt)
            template = t_res.first()
            if not template:
                return f"Error: No chore template found with name '{chore_name}'."

            # 2. Find today's pending instance
            today_date = date.today()
            # Ensure generated
            await ChoreService.ensure_household_reset(session, MOCK_HOME_ID, today_date)

            inst_stmt = select(ChoreInstance).where(
                ChoreInstance.home_id == MOCK_HOME_ID,
                ChoreInstance.template_id == template.id,
                ChoreInstance.due_date == today_date,
            )
            inst_res = await session.exec(inst_stmt)
            instance = inst_res.first()
            if not instance:
                return f"Error: No chore instance scheduled for today with name '{chore_name}'."

            if instance.status == "completed":
                return f"Info: Chore '{chore_name}' was already completed today."

            # 3. Complete instance
            updated = await ChoreService.complete_chore_instance(
                session=session,
                instance_id=instance.id,
                completed_by=MOCK_USER_ID,
                home_id=MOCK_HOME_ID,
            )
            return f"Success: Completed chore '{chore_name}' (Instance ID: {updated.id}) and awarded {updated.points_awarded} points!"

    except Exception as e:
        return f"Error: Failed to complete chore: {str(e)}"


@mcp.tool()
async def assign_chore(chore_instance_id: str, user_id: str) -> str:
    """Assign a scheduled chore instance to a household member.

    Parameters:
    - chore_instance_id: UUID string of the chore instance.
    - user_id: UUID string of the user to assign the chore to.
    """
    try:
        inst_uuid = uuid.UUID(chore_instance_id)
        user_uuid = uuid.UUID(user_id)

        async with async_session_factory() as session:
            payload = ChoreAssignRequest(assigned_to=user_uuid)
            updated = await ChoreService.assign_chore_instance(
                session=session,
                instance_id=inst_uuid,
                payload=payload,
                home_id=MOCK_HOME_ID,
            )
            return f"Success: Assigned chore instance {updated.id} to user {user_uuid}."

    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to assign chore: {str(e)}"
