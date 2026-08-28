"""Database connection, session management, and initialization for Library microservice."""

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

# Database connection settings
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/library",
)
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "t")

# Create the async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=DEBUG,
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
    """Initialize database tables by creating all registered SQLModel models."""
    from src.db.models import Item, LendingRecord, Location, ProviderSubscription  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
