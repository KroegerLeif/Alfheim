"""Model registry and migration lock key of the Maintenance service (runner: ``backend_shared.db``)."""

MIGRATION_LOCK_KEY = 7_265_006  # pg_advisory_xact_lock key, scoped per database; never change it


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from app.features.devices.models import Device  # noqa: F401
    from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent  # noqa: F401
