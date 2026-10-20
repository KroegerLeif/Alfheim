"""Database connection, session management, and initialization for Library microservice."""

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.migrations import run_migrations

# Database connection settings
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://library_user:postgres@localhost:5432/alfheim_library",
)
SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() in ("true", "1", "t")

# Create the async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=SQL_ECHO,
    future=True,
)

# Configure the session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async database session dependency for FastAPI routes."""
    async with async_session_factory() as session:
        yield session


async def init_db() -> None:
    """Bring the database schema to the latest Alembic revision (see ``src.db.migrations``)."""
    await run_migrations(engine)
