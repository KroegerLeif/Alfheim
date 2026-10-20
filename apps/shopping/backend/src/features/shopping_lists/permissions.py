"""Household role matrix of the Shopping routes.

GUEST is read-only for shared household data: creating, reordering or deleting shared
lists, changing their items and the quick-selection history require MEMBER or higher
(:data:`WRITE_ROLES`). A Personal List belongs to its owner alone and stays fully manageable
for every role. Denials answer 403 ``household_role_forbidden``.
"""

import uuid

from backend_shared.household import HouseholdContext, HouseholdRole, require_household, require_role
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.features.shopping_lists.services.list_management_service import ListManagementService

WRITE_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN", "MEMBER")

#: Dependency for routes that change shared household data (MEMBER, ADMIN, OWNER).
require_writer = require_role(*WRITE_ROLES)


async def require_list_writer(
    list_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_household),
) -> HouseholdContext:
    """Allow changes to the list in the path: any role on the caller's Personal List, MEMBER or higher otherwise.

    The list is resolved with the same boundary checks as the service (a foreign list is a 404),
    so a role denial never reveals whether a list of another household exists.
    """
    db_list = await ListManagementService.get_list(session, list_id, context.household_id, context.user_id)
    if db_list.is_personal:
        return context
    return await require_writer(context)


__all__ = ["WRITE_ROLES", "require_list_writer", "require_writer"]
