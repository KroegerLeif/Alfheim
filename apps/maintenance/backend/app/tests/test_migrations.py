"""Schema migration tests: fresh install, legacy ``create_all`` adoption and drift against the models.

The SQLite tests always run. The PostgreSQL tests run when ALFHEIM_MIGRATION_TEST_DATABASE_URL points at a
disposable database (its public schema is dropped and recreated), e.g.:

    docker run -d --rm -p 55432:5432 -e POSTGRES_PASSWORD=x postgres:16-alpine
    ALFHEIM_MIGRATION_TEST_DATABASE_URL=postgresql+asyncpg://postgres:x@localhost:55432/postgres pytest
"""

import asyncio
import os
from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
import pytest_asyncio
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from app.core.migrations import alembic_config, load_models, run_migrations
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel

POSTGRES_URL = os.getenv("ALFHEIM_MIGRATION_TEST_DATABASE_URL")
requires_postgres = pytest.mark.skipif(
    not POSTGRES_URL, reason="ALFHEIM_MIGRATION_TEST_DATABASE_URL not set; skipping PostgreSQL migration test"
)

# Other test modules may register throwaway tables on the shared metadata; only the service's own tables count here.
APP_TABLES = {"servicehistoryevent", "maintenancestep", "device"}

# A row for a root table (":id" and ":owner" are bound to fresh UUIDs) and the query that reads it back.
INSERT_ROW_SQL = "INSERT INTO device (id, name, model, serial, category, location, status, household_id) VALUES (1, 'Boiler', 'B1', 'S1', 'heating', 'basement', 'active', :owner)"
SELECT_ROW_SQL = "SELECT name FROM device"
EXPECTED_ROW = "Boiler"
# A table without dependants that is safe to drop in the "skipped release" scenario.
DROPPABLE_TABLE = "servicehistoryevent"
# DDL turning a freshly created PostgreSQL schema into the shape older releases had (empty: no drift so far).
LEGACY_POSTGRES_DDL: list[str] = []

# The schema before households became UUIDs owned by core/household: a local household table and an
# integer device.household_id, with the same index names the current schema uses.
PRE_UUID_DDL = [
    "CREATE TABLE household (id SERIAL PRIMARY KEY, name VARCHAR NOT NULL)",
    "CREATE TABLE device (id SERIAL PRIMARY KEY, name VARCHAR NOT NULL, model VARCHAR NOT NULL, "
    "serial VARCHAR NOT NULL, category VARCHAR NOT NULL, location VARCHAR NOT NULL, status VARCHAR NOT NULL, "
    "service_interval_months INTEGER, notes VARCHAR, household_id INTEGER REFERENCES household (id))",
    "CREATE INDEX ix_device_household_id ON device (household_id)",
    "CREATE TABLE maintenancestep (id SERIAL PRIMARY KEY, title VARCHAR NOT NULL, description VARCHAR, "
    "recurrence INTEGER NOT NULL, supply_item VARCHAR, supply_needed_date VARCHAR, last_completed VARCHAR, "
    "device_id INTEGER NOT NULL REFERENCES device (id))",
    "CREATE TABLE servicehistoryevent (id SERIAL PRIMARY KEY, date VARCHAR NOT NULL, performer VARCHAR NOT NULL, "
    "notes VARCHAR, device_id INTEGER NOT NULL REFERENCES device (id), completed_steps JSON)",
    "INSERT INTO household (id, name) VALUES (1, 'Home')",
    "INSERT INTO device (id, name, model, serial, category, location, status, household_id) "
    "VALUES (1, 'Old boiler', 'B0', 'S0', 'heating', 'basement', 'active', 1)",
]


@pytest.mark.parametrize(
    "legacy_ddl",
    [
        ["CREATE TABLE household (id INTEGER PRIMARY KEY, name VARCHAR)"],
        ["CREATE TABLE device (id INTEGER PRIMARY KEY, household_id INTEGER)"],
    ],
)
async def test_legacy_integer_household_schema_is_rejected_on_sqlite(sqlite_engine: AsyncEngine, legacy_ddl: list[str]):
    """The legacy conversion needs PostgreSQL schemas; elsewhere startup fails loudly instead of serving it."""
    async with sqlite_engine.begin() as connection:
        for statement in legacy_ddl:
            await connection.execute(text(statement))

    with pytest.raises(RuntimeError, match="legacy integer household schema"):
        await run_migrations(sqlite_engine)


def _is_app_object(obj: object, name: str | None, type_: str, reflected: bool, compare_to: object) -> bool:
    return type_ != "table" or name in APP_TABLES


def _schema_diff(connection: Connection) -> list:
    """Return the differences between the database and the models (what the Alembic check command reports)."""
    context = MigrationContext.configure(connection, opts={"compare_type": True, "include_object": _is_app_object})
    return compare_metadata(context, SQLModel.metadata)


def _head_revision() -> str:
    head = ScriptDirectory.from_config(alembic_config()).get_current_head()
    assert head is not None
    return head


async def _current_revision(engine: AsyncEngine) -> str | None:
    async with engine.connect() as connection:
        return await connection.run_sync(lambda sync: MigrationContext.configure(sync).get_current_revision())


@pytest_asyncio.fixture
async def sqlite_engine() -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def postgres_engine() -> AsyncGenerator[AsyncEngine, None]:
    assert POSTGRES_URL
    engine = create_async_engine(POSTGRES_URL)
    async with engine.begin() as connection:
        await connection.execute(text("DROP SCHEMA public CASCADE"))
        await connection.execute(text("CREATE SCHEMA public"))
    yield engine
    await engine.dispose()


async def _insert_row(engine: AsyncEngine) -> None:
    """Insert a row with raw SQL so the test does not depend on ORM defaults."""
    sqlite = engine.dialect.name == "sqlite"
    async with engine.begin() as connection:
        await connection.execute(
            text(INSERT_ROW_SQL),
            {"id": uuid4().hex if sqlite else uuid4(), "owner": uuid4().hex if sqlite else uuid4()},
        )


async def _rows(engine: AsyncEngine) -> list[str]:
    async with engine.connect() as connection:
        return [row[0] for row in await connection.execute(text(SELECT_ROW_SQL))]


async def test_migrations_build_the_full_schema_on_an_empty_sqlite_database(sqlite_engine: AsyncEngine):
    await run_migrations(sqlite_engine)

    async with sqlite_engine.connect() as connection:
        tables = set(await connection.run_sync(lambda sync: inspect(sync).get_table_names()))
        assert tables == APP_TABLES | {"alembic_version"}
        assert await connection.run_sync(_schema_diff) == []
    assert await _current_revision(sqlite_engine) == _head_revision()


async def test_running_migrations_twice_is_a_no_op(sqlite_engine: AsyncEngine):
    await run_migrations(sqlite_engine)
    await _insert_row(sqlite_engine)

    await run_migrations(sqlite_engine)

    assert await _rows(sqlite_engine) == [EXPECTED_ROW]
    assert await _current_revision(sqlite_engine) == _head_revision()


async def test_legacy_create_all_database_is_stamped_and_keeps_its_data(sqlite_engine: AsyncEngine):
    load_models()
    async with sqlite_engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
    await _insert_row(sqlite_engine)

    await run_migrations(sqlite_engine)

    assert await _rows(sqlite_engine) == [EXPECTED_ROW]
    assert await _current_revision(sqlite_engine) == _head_revision()


async def test_legacy_database_missing_a_table_gets_it_created(sqlite_engine: AsyncEngine):
    load_models()
    async with sqlite_engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
        await connection.execute(text(f"DROP TABLE {DROPPABLE_TABLE}"))

    await run_migrations(sqlite_engine)

    async with sqlite_engine.connect() as connection:
        assert await connection.run_sync(lambda sync: inspect(sync).has_table(DROPPABLE_TABLE))


@requires_postgres
async def test_postgres_upgrade_matches_the_models_and_downgrades_cleanly(postgres_engine: AsyncEngine):
    await run_migrations(postgres_engine)

    async with postgres_engine.connect() as connection:
        assert await connection.run_sync(_schema_diff) == []

    def downgrade_and_upgrade(connection: Connection) -> None:
        config = alembic_config(connection)
        command.downgrade(config, "base")
        assert set(inspect(connection).get_table_names()) == {"alembic_version"}
        command.upgrade(config, "head")

    async with postgres_engine.connect() as connection:
        await connection.run_sync(downgrade_and_upgrade)
        await connection.commit()
        assert await connection.run_sync(_schema_diff) == []


@requires_postgres
async def test_postgres_legacy_database_is_upgraded_to_the_current_schema(postgres_engine: AsyncEngine):
    load_models()
    async with postgres_engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
        for statement in LEGACY_POSTGRES_DDL:
            await connection.execute(text(statement))
        if LEGACY_POSTGRES_DDL:
            assert await connection.run_sync(_schema_diff) != []
    await _insert_row(postgres_engine)

    await run_migrations(postgres_engine)

    assert await _rows(postgres_engine) == [EXPECTED_ROW]
    async with postgres_engine.connect() as connection:
        assert await connection.run_sync(_schema_diff) == []


@requires_postgres
async def test_concurrent_startups_serialize_on_the_advisory_lock(postgres_engine: AsyncEngine):
    await asyncio.gather(*(run_migrations(postgres_engine) for _ in range(4)))

    assert await _current_revision(postgres_engine) == _head_revision()
    async with postgres_engine.connect() as connection:
        assert await connection.run_sync(_schema_diff) == []


@requires_postgres
async def test_postgres_pre_uuid_schema_is_moved_aside_without_losing_rows(postgres_engine: AsyncEngine):
    async with postgres_engine.begin() as connection:
        for statement in PRE_UUID_DDL:
            await connection.execute(text(statement))

    await run_migrations(postgres_engine)

    async with postgres_engine.connect() as connection:
        assert await connection.run_sync(_schema_diff) == []
        assert (await connection.execute(text("SELECT count(*) FROM device"))).scalar_one() == 0
        legacy_devices = await connection.execute(text("SELECT name, household_id FROM legacy_maintenance.device"))
        assert [tuple(row) for row in legacy_devices] == [("Old boiler", 1)]
        legacy_households = await connection.execute(text("SELECT name FROM legacy_maintenance.household"))
        assert [row[0] for row in legacy_households] == ["Home"]
    assert await _current_revision(postgres_engine) == _head_revision()
