"""Test-process environment, applied before any app module (and its import-time config validation) loads."""

import os

# main.py calls configure_household_auth(), which requires the internal token; the membership
# API itself is stubbed per test with backend_shared.household.testing.override_membership().
os.environ.setdefault("ALFHEIM_INTERNAL_TOKEN", "test-internal-token")
