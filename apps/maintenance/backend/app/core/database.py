from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.migrations import run_migrations

# Create the async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,
    future=True,
)

# Configure the session factory
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
    """Bring the database schema to the latest Alembic revision (see ``app.core.migrations``).

    A database still on the pre-UUID integer-household schema is moved aside by revision 0002 instead of
    being served broken.
    """
    await run_migrations(engine)
