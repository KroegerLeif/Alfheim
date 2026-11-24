"""MCP tool that creates a one-off chore instance (#959); household and caller come from the request context."""

import uuid
from datetime import date

from backend_shared import mcp_middleware
from backend_shared.household import MembershipServiceError, derive_user_id
from backend_shared.household.permissions import WRITE_ROLES
from backend_shared.mcp_middleware import get_mcp_household_context
from backend_shared.mcp_permissions import mcp_requires_role
from src.core.database import async_session_factory
from src.features.chore_management.exceptions import ChoreError
from src.features.chore_management.services.one_off_service import OneOffInstanceService
from src.mcp.server import mcp


@mcp.tool()
@mcp_requires_role(*WRITE_ROLES)
async def create_chore_instance(
    template_id: str, due_date: str | None = None, assignee_user_id: str | None = None
) -> str:
    """Create one extra chore instance from a chore template now, without changing its schedule.

    Parameters:
    - template_id: UUID string of a chore template of the household.
    - due_date: Optional ISO date (YYYY-MM-DD) the chore is due; defaults to today.
    - assignee_user_id: Optional user id (UUID) or Zitadel user id (sub) of the member to assign it to.

    Assigning the chore to someone other than the caller requires an OWNER/ADMIN household role.
    """
    # The role decorator already required the context, so it is present here.
    context = get_mcp_household_context()
    try:
        template_uuid = uuid.UUID(template_id)
        due = date.fromisoformat(due_date) if due_date else None
        assignee = derive_user_id(assignee_user_id) if assignee_user_id else None
    except ValueError as e:
        return f"Error: Invalid template id or due date: {e!s}"

    try:
        await OneOffInstanceService.check_assignee(mcp_middleware.get_membership_client(), context, assignee)
        async with async_session_factory() as session:
            instance, _ = await OneOffInstanceService.create_instance(
                session=session,
                home_id=context.household_id,
                template_id=template_uuid,
                due_date=due,
                assignee_id=assignee,
            )
            return f"Success: Created chore instance {instance.id} due {instance.due_date}."
    except MembershipServiceError:
        return "Error: Household members cannot be checked right now."
    except ChoreError as e:
        return f"Error: {e!s}"
