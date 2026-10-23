"""Alembic environment.

Migrations run in two modes:

* Programmatically at application startup (``src.core.migrations.run_migrations``): the caller
  hands over its own connection through ``config.attributes["connection"]`` so the migration runs
  inside the caller's transaction and advisory lock.
* From the ``alembic`` CLI (``alembic upgrade head``, ``alembic check``, ``alembic revision
  --autogenerate``): a dedicated async engine is created from ``settings.DATABASE_URL``.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel
from src.core.config import settings
from src.core.migrations import load_models

config = context.config

# The CLI configures logging from alembic.ini; an in-process run keeps the application's logging.
if config.config_file_name and config.attributes.get("connection") is None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

# Register every model on SQLModel.metadata so autogenerate and `alembic check` see the full schema.
load_models()
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode: emit SQL for the configured URL without connecting."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations on an open synchronous connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations through a dedicated async engine (CLI usage)."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
        await connection.commit()

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations against the caller's connection, or a dedicated engine when invoked from the CLI."""
    connection = config.attributes.get("connection")
    if connection is not None:
        do_run_migrations(connection)
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
