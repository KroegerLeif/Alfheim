"""Shared body of every backend's Alembic ``env.py``.

Migrations run in two modes:

* Programmatically at application startup (``backend_shared.db.run_migrations``): the caller hands
  over its own connection through ``config.attributes["connection"]`` so the migration runs inside
  the caller's transaction and advisory lock.
* From the ``alembic`` CLI (``alembic upgrade head``, ``alembic check``, ``alembic revision
  --autogenerate``): a dedicated async engine is created from the injected database URL.
"""

import asyncio
import logging.config
from collections.abc import Callable
from typing import Any

from alembic import context
from alembic.config import Config
from alembic.runtime.environment import IncludeObjectFn
from sqlalchemy import MetaData, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Arguments: schema object, name, object type ("table", "index", ...), reflected, compared-to object.
IncludeObject = Callable[[Any, str | None, str, bool, Any], bool]

# Logging for CLI runs; an in-process run keeps the application's logging untouched.
CLI_LOGGING: dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"generic": {"format": "%(levelname)-5.5s [%(name)s] %(message)s", "datefmt": "%H:%M:%S"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "generic", "stream": "ext://sys.stderr"}},
    "root": {"level": "WARNING", "handlers": ["console"]},
    "loggers": {"alembic": {"level": "INFO"}},
}


def ignore_indexes(names: frozenset[str] | set[str]) -> IncludeObject:
    """Build an ``include_object`` hook that hides indexes the models do not declare.

    Args:
        names: Index names created with raw SQL (for example expression or operator-class indexes)
            that autogenerate and ``alembic check`` must not report as drift.

    Returns:
        A callable for ``context.configure(include_object=...)`` that rejects exactly those indexes.
    """
    hidden = frozenset(names)

    def include_object(obj: Any, name: str | None, type_: str, reflected: bool, compare_to: Any) -> bool:
        return not (type_ == "index" and name in hidden)

    return include_object


def run_env(
    target_metadata: MetaData,
    *,
    database_url: str,
    include_object: IncludeObjectFn | None = None,
    version_table_schema: str | None = None,
) -> None:
    """Run the current Alembic command; call this once from an app's ``alembic/env.py``.

    Args:
        target_metadata: Metadata with every model registered, compared by autogenerate and ``alembic check``.
        database_url: Async SQLAlchemy URL used when the CLI runs without a caller-provided connection.
        include_object: Optional filter for objects autogenerate must ignore (see ``ignore_indexes``).
        version_table_schema: Optional schema that holds the ``alembic_version`` table.
    """
    config = context.config
    connection = config.attributes.get("connection")
    if config.config_file_name and connection is None:
        logging.config.dictConfig(CLI_LOGGING)
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

    options: dict[str, Any] = {"target_metadata": target_metadata, "compare_type": True}
    if include_object is not None:
        options["include_object"] = include_object
    if version_table_schema is not None:
        options["version_table_schema"] = version_table_schema

    if context.is_offline_mode():
        _run_offline(config, options)
    elif connection is not None:
        _run_on_connection(connection, options)
    else:
        asyncio.run(_run_with_dedicated_engine(config, options))


def _run_offline(config: Config, options: dict[str, Any]) -> None:
    """Emit SQL for the configured URL without connecting."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **options,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_on_connection(connection: Connection, options: dict[str, Any]) -> None:
    """Run migrations on an open synchronous connection."""
    context.configure(connection=connection, **options)
    with context.begin_transaction():
        context.run_migrations()


async def _run_with_dedicated_engine(config: Config, options: dict[str, Any]) -> None:
    """Run migrations through a dedicated async engine (CLI usage)."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_run_on_connection, options)
        await connection.commit()
    await connectable.dispose()
