"""Async SQLAlchemy engine and session factory for ``postgres-core``."""

from collections.abc import AsyncGenerator
from pathlib import Path

from backend_shared import db
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.config import settings
from src.core.migrations import MIGRATION_LOCK_KEY, load_models

# Backend root holding alembic.ini and the alembic/ script directory.
BACKEND_DIR = Path(__file__).resolve().parents[2]

engine, async_session_factory = db.create_engine_and_session(settings)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session dependency for FastAPI routes."""
    async with async_session_factory() as session:
        yield session


async def run_migrations(target: AsyncEngine) -> None:
    """Upgrade the database behind ``target`` to the Alembic head revision under this service's lock."""
    await db.run_migrations(
        target, load_models, MIGRATION_LOCK_KEY, backend_dir=BACKEND_DIR, metadata=SQLModel.metadata
    )


async def init_db() -> None:
    """Bring the database schema to the latest Alembic revision (see ``backend_shared.db``)."""
    await run_migrations(engine)
