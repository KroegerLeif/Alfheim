from collections.abc import AsyncGenerator

from sqlalchemy import Connection, inspect
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings

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


class LegacyHouseholdSchemaError(RuntimeError):
    """The database still has the pre-UUID schema (local ``household`` table / integer ``device.household_id``)."""


LEGACY_SCHEMA_MESSAGE = (
    "The maintenance database still uses the legacy integer household schema "
    "(local 'household' table / integer device.household_id). Households are now UUIDs owned by "
    "core/household and the schema is created with create_all, which cannot change column types. "
    "Drop the maintenance tables (servicehistoryevent, maintenancestep, device, household) and restart; "
    "see the 'Data reset required' section of the PR that introduced UUID households."
)


def check_legacy_household_schema(connection: Connection) -> None:
    """Fail fast instead of serving requests against a schema that can never match UUID households."""
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    if "household" in tables:
        raise LegacyHouseholdSchemaError(LEGACY_SCHEMA_MESSAGE)
    if "device" in tables:
        columns = {column["name"]: column for column in inspector.get_columns("device")}
        household_column = columns.get("household_id")
        if household_column is not None and _python_type(household_column["type"]) is int:
            raise LegacyHouseholdSchemaError(LEGACY_SCHEMA_MESSAGE)


def _python_type(column_type: object) -> type | None:
    try:
        return getattr(column_type, "python_type", None)
    except NotImplementedError:
        return None


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session dependency for FastAPI routes."""
    async with async_session_factory() as session:
        yield session


async def init_db() -> None:
    """Initialize the database tables.

    Imports all models to ensure they register with SQLModel.metadata. Refuses to start on the
    legacy integer-household schema (no automatic data migration: see LEGACY_SCHEMA_MESSAGE).
    """
    async with engine.begin() as conn:
        await conn.run_sync(check_legacy_household_schema)
        await conn.run_sync(SQLModel.metadata.create_all)
