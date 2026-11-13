"""Alembic configuration for a backend directory that holds ``alembic.ini`` and ``alembic/``."""

from pathlib import Path

from alembic.config import Config
from sqlalchemy.engine import Connection


def alembic_config(backend_dir: Path, connection: Connection | None = None) -> Config:
    """Build the Alembic configuration of one backend, optionally bound to an open connection.

    Args:
        backend_dir: Backend root containing ``alembic.ini`` and the ``alembic/`` script directory.
        connection: Open connection the migration must run on; ``env.py`` then reuses it instead of
            creating its own engine, so the run joins the caller's transaction and advisory lock.

    Returns:
        The Alembic ``Config`` with an absolute ``script_location``.
    """
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    if connection is not None:
        config.attributes["connection"] = connection
    return config
