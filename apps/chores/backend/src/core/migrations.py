"""Model registry and migration lock key of the Chores service (runner: ``backend_shared.db``)."""

MIGRATION_LOCK_KEY = 7_265_002  # pg_advisory_xact_lock key, scoped per database; never change it


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from src.features.chore_management.models import (  # noqa: F401
        ChoreCompletionHistory,
        ChoreInstance,
        ChoreTemplate,
        HouseholdStreak,
    )
