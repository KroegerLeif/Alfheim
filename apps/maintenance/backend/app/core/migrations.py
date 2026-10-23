"""Schema migrations applied programmatically at application startup.

``run_migrations`` brings the database to the Alembic head revision before the service accepts
traffic:

* Empty database: ``alembic upgrade head`` builds the whole schema from the baseline revision.
* Database created by the former ``SQLModel.metadata.create_all`` startup (application tables but
  no ``alembic_version`` table): missing tables are created, the baseline revision is stamped and
  ``upgrade head`` then applies the idempotent revisions that bring older table shapes up to date.
* Otherwise: plain ``alembic upgrade head``.

Everything runs in one transaction on a single connection, guarded by a PostgreSQL advisory lock,
so concurrent replicas serialize and a failing migration leaves the schema untouched.
"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel

logger = logging.getLogger(__name__)

# Revision that matches the schema `create_all` produced before Alembic became the schema owner.
BASELINE_REVISION = "0001"
# Constant key of this service's `pg_advisory_xact_lock`; advisory locks are scoped per database.
MIGRATION_LOCK_KEY = 7_265_006
_BACKEND_DIR = Path(__file__).resolve().parents[2]


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from app.features.devices.models import Device  # noqa: F401
    from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent  # noqa: F401


def alembic_config(connection: Connection | None = None) -> Config:
    """Build the Alembic configuration, optionally bound to an already open connection."""
    config = Config(str(_BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    if connection is not None:
        config.attributes["connection"] = connection
    return config


def _migrate(connection: Connection) -> None:
    """Adopt a legacy ``create_all`` database if necessary, then upgrade to head."""
    config = alembic_config(connection)
    tables = set(inspect(connection).get_table_names())
    if "alembic_version" not in tables and tables & set(SQLModel.metadata.tables):
        logger.info("Adopting a database created without migrations: stamping baseline %s", BASELINE_REVISION)
        # Cover tables a skipped release would have added; existing tables are left untouched.
        SQLModel.metadata.create_all(connection)
        command.stamp(config, BASELINE_REVISION)
    command.upgrade(config, "head")


async def run_migrations(engine: AsyncEngine) -> None:
    """Upgrade the database behind ``engine`` to the Alembic head revision."""
    load_models()
    async with engine.connect() as connection:
        if connection.dialect.name == "postgresql":
            # Released with the transaction, so replicas booting together run the migrations one by one.
            await connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": MIGRATION_LOCK_KEY})
        await connection.run_sync(_migrate)
        await connection.commit()
