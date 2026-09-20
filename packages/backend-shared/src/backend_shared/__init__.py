"""Shared backend infrastructure package for Alfheim services."""

from backend_shared.dependencies import (
    decode_oidc_token,
    get_jwks_client,
    is_mock_auth_allowed,
)
from backend_shared.household import (
    HouseholdContext,
    HouseholdRole,
    configure_household_auth,
    require_household,
    require_role,
)
from backend_shared.storage import (
    S3StorageService,
    StorageSettings,
    get_household_object_key,
    get_user_object_key,
)
from backend_shared.telemetry import (
    JSONFormatter,
    configure_logging,
    setup_telemetry,
    shutdown_telemetry,
)

__all__ = [
    "StorageSettings",
    "get_household_object_key",
    "get_user_object_key",
    "S3StorageService",
    "JSONFormatter",
    "configure_logging",
    "setup_telemetry",
    "shutdown_telemetry",
    "is_mock_auth_allowed",
    "get_jwks_client",
    "decode_oidc_token",
    "HouseholdContext",
    "HouseholdRole",
    "configure_household_auth",
    "require_household",
    "require_role",
]
