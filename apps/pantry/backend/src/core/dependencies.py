"""Pantry-local identity constants.

Authentication and household authorization live in ``backend_shared.household``
(``require_household`` / ``require_role``); membership is confirmed by the
household app. Only the fixed ids used by the demo seeders remain here.
"""

import uuid

MOCK_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
MOCK_HOME_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
