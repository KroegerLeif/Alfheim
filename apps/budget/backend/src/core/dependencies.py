"""Dependencies module re-exporting core application dependencies.

Household membership is confirmed by the household app (``core/household``) through
:func:`backend_shared.household.require_household`.
"""

from backend_shared.household import HouseholdContext, require_household
from src.core.database import get_db_session

__all__ = ["HouseholdContext", "get_db_session", "require_household"]
