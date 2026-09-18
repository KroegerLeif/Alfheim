"""Test helpers: authenticated household headers backed by a stubbed household membership API."""

from uuid import uuid4

from backend_shared.household import HouseholdRole
from backend_shared.household.testing import StaticMembershipLookup, make_test_token

#: Membership table answering ``require_household`` in tests (installed by the ``client`` fixture).
MEMBERSHIPS = StaticMembershipLookup()


def create_auth_headers(
    user_id: str | None = None,
    household_id: str | None = None,
    role: HouseholdRole | None = "OWNER",
) -> dict[str, str]:
    """Return JWT + ``X-Household-ID`` headers and register the user as a member of the household.

    Pass ``role=None`` to build headers for a user who is *not* a member.
    """
    uid = user_id or str(uuid4())
    hid = household_id or str(uuid4())
    MEMBERSHIPS.set(hid, uid, role)
    return {
        "Authorization": f"Bearer {make_test_token(uid)}",
        "X-Household-ID": hid,
    }
