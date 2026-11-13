"""Model registry and migration lock key of the Budget service (runner: ``backend_shared.db``)."""

MIGRATION_LOCK_KEY = 7_265_001  # pg_advisory_xact_lock key, scoped per database; never change it


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from src.core.audit.models import AuditLog  # noqa: F401
    from src.features.accounts.models import Account  # noqa: F401
    from src.features.plans.models import Plan, PlanCategory  # noqa: F401
    from src.features.pots.models import Pot  # noqa: F401
    from src.features.transactions.models import Transaction  # noqa: F401
