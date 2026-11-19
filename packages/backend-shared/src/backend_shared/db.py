"""Async database engine factory and the startup migration runner shared by every Python backend.

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
from collections.abc import Callable
from functools import partial
from pathlib import Path
from typing import Protocol

from alembic import command
from sqlalchemy import MetaData, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from backend_shared.migrations import alembic_config

logger = logging.getLogger(__name__)

# Revision that matches the schema `create_all` produced before Alembic became the schema owner.
BASELINE_REVISION = "0001"


class DatabaseSettings(Protocol):
    """Settings fields ``create_engine_and_session`` reads."""

    DATABASE_URL: str
    SQL_ECHO: bool


def create_engine_and_session(settings: DatabaseSettings) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create the async engine and the session factory of one backend.

    Args:
        settings: The backend's settings; ``DATABASE_URL`` must be an async driver URL and
            ``SQL_ECHO`` logs every statement (kept apart from ``DEBUG`` because statements may
            contain personal data).

    Returns:
        The engine and a session factory bound to it that does not expire objects on commit.
    """
    engine = create_async_engine(settings.DATABASE_URL, echo=settings.SQL_ECHO, future=True)
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def _migrate(connection: Connection, *, backend_dir: Path, metadata: MetaData, baseline_revision: str) -> None:
    """Adopt a legacy ``create_all`` database if necessary, then upgrade to head."""
    config = alembic_config(backend_dir, connection)
    tables = set(inspect(connection).get_table_names())
    if "alembic_version" not in tables and tables & set(metadata.tables):
        logger.info("Adopting a database created without migrations: stamping baseline %s", baseline_revision)
        # Cover tables a skipped release would have added; existing tables are left untouched.
        metadata.create_all(connection)
        command.stamp(config, baseline_revision)
    command.upgrade(config, "head")


async def run_migrations(
    engine: AsyncEngine,
    load_models: Callable[[], None],
    lock_key: int,
    *,
    backend_dir: Path,
    metadata: MetaData,
    baseline_revision: str = BASELINE_REVISION,
) -> None:
    """Upgrade the database behind ``engine`` to the Alembic head revision.

    Args:
        engine: Engine of the database to migrate.
        load_models: Imports every model module so all tables are registered on ``metadata``.
        lock_key: Constant ``pg_advisory_xact_lock`` key of the service; advisory locks are scoped
            per database, and the key must never change once released.
        backend_dir: Backend root containing ``alembic.ini`` and the ``alembic/`` script directory.
        metadata: Metadata the models register on, used to detect and adopt a legacy database.
        baseline_revision: Revision stamped onto a legacy ``create_all`` database.
    """
    load_models()
    async with engine.connect() as connection:
        if connection.dialect.name == "postgresql":
            # Released with the transaction, so replicas booting together run the migrations one by one.
            await connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
        migrate = partial(_migrate, backend_dir=backend_dir, metadata=metadata, baseline_revision=baseline_revision)
        await connection.run_sync(migrate)
        await connection.commit()
