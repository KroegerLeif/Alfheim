"""Household-scoped request dependencies for the Library microservice.

Membership and roles are owned by the household app (``core/household``);
:func:`backend_shared.household.require_household` validates the JWT, reads
``X-Household-ID`` and confirms membership through the household app's internal
membership API.
"""

import uuid

from backend_shared.household import HouseholdContext, require_household
from fastapi import Depends


async def get_current_household_id(
    context: HouseholdContext = Depends(require_household),
) -> uuid.UUID:
    """Return the household UUID confirmed by :func:`require_household` for route handlers."""
    return context.household_id
