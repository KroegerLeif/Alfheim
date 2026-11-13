"""Model registry and migration lock key of the Pantry service (runner: ``backend_shared.db``)."""

MIGRATION_LOCK_KEY = 7_265_005  # pg_advisory_xact_lock key, scoped per database; never change it


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from src.features.categories import Category  # noqa: F401
    from src.features.inventory.models import InventoryLedger, InventoryState  # noqa: F401
    from src.features.locations import Location  # noqa: F401
    from src.features.products import Product, ProductNutrition  # noqa: F401
