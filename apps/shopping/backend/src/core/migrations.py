"""Model registry and migration lock key of the Shopping service (runner: ``backend_shared.db``)."""

MIGRATION_LOCK_KEY = 7_265_004  # pg_advisory_xact_lock key, scoped per database; never change it


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from src.features.history.models import ShoppingHistory  # noqa: F401
    from src.features.shopping_lists.models import ShoppingItem, ShoppingList  # noqa: F401
