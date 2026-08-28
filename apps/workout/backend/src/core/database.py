from collections.abc import AsyncGenerator

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
    """Initialize the database tables.

    Imports all models to ensure they register with SQLModel.metadata.
    """
    # Import models to register them on SQLModel.metadata
    from src.features.equipment.models import Equipment  # noqa: F401
    from src.features.exercises.models import (  # noqa: F401
        Exercise,
        ExerciseFavorite,
        UserExercisePreference,
    )
    from src.features.plans.models import Plan, PlanDay, PlanExercise, PlanSet  # noqa: F401
    from src.features.session.models import (  # noqa: F401
        SessionExercise,
        SessionSet,
        WorkoutSession,
    )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
