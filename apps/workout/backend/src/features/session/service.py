"""Façade service for the session feature.

router.py and mcp_tools.py both import from here, never directly from
services/*.py, so the clone-from-plan lifecycle logic and the offline-sync
upsert logic each stay in exactly one place.
"""

from src.features.session.services.session_lifecycle_service import (
    abandon_session,
    complete_session,
    get_session,
    list_sessions,
    start_session,
)
from src.features.session.services.session_sync_service import sync_sets

__all__ = [
    "start_session",
    "get_session",
    "list_sessions",
    "complete_session",
    "abandon_session",
    "sync_sets",
]
