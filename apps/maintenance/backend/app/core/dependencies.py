"""Household-scoped request dependencies for the maintenance service.

Households, memberships and roles are owned by the household app (``core/household``).
:func:`backend_shared.household.require_household` validates the JWT, reads the UUID
``X-Household-ID`` header and confirms membership through the household app's internal
membership API.
"""

from backend_shared.household import HouseholdContext, require_household
from fastapi import Request


def get_authorization(request: Request) -> str | None:
    """Return the caller's ``Authorization`` header so downstream service calls act on their behalf."""
    return request.headers.get("Authorization")


__all__ = ["HouseholdContext", "get_authorization", "require_household"]
