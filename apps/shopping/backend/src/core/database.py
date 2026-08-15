from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import settings

# Create the async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
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
    """Initialize the database tables and apply auto-migrations.

    Imports all models to ensure they register with SQLModel.metadata.
    Executes raw SQL DDL migrations to ensure column additions for existing tables.
    """
    from src.features.history.models import ShoppingHistory  # noqa: F401
    from src.features.shopping_lists.models import ShoppingItem, ShoppingList  # noqa: F401

    # 1. Create tables if they do not exist in an isolated transaction
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # 2. Run schema column migrations for pre-existing database instances in separate transaction blocks
    statements = [
        "ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE",
        "ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE",
        "ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0",
    ]
    for stmt in statements:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            pass
