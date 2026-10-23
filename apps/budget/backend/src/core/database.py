from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.config import settings
from src.core.migrations import run_migrations

# Create async engine for database operations
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,
    future=True,
)

# Create session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session dependency for FastAPI routes."""
    async with async_session_factory() as session:
        yield session


async def init_db() -> None:
    """Bring the database schema to the latest Alembic revision (see ``src.core.migrations``)."""
    await run_migrations(engine)
