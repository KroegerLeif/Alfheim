"""Model registry and migration lock key of the Library service (runner: ``backend_shared.db``)."""

from backend_shared.migrations import ignore_indexes

MIGRATION_LOCK_KEY = 7_265_007  # pg_advisory_xact_lock key, scoped per database; never change it
# Created by revision 0002 with raw SQL (expression and operator-class indexes), so not on the metadata.
include_object = ignore_indexes({"ix_items_trgm_title", "ix_items_fts"})


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from src.db.models import Item, LendingRecord, Location, ProviderSubscription  # noqa: F401
