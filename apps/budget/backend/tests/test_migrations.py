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
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from src.core.migrations import alembic_config, load_models, run_migrations

POSTGRES_URL = os.getenv("ALFHEIM_MIGRATION_TEST_DATABASE_URL")
requires_postgres = pytest.mark.skipif(
    not POSTGRES_URL, reason="ALFHEIM_MIGRATION_TEST_DATABASE_URL not set; skipping PostgreSQL migration test"
)


# Other test modules register throwaway tables on the shared metadata; only the service's own tables count here.
APP_TABLES = {"accounts", "audit_logs", "plans", "plan_categories", "pots", "transactions"}


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


async def _create_account(engine: AsyncEngine) -> None:
    """Insert an account with raw SQL (naive timestamps: the ORM defaults are tz-aware and asyncpg rejects them)."""
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO accounts (id, household_id, name, account_type, balance, currency, is_active, "
                "created_at, updated_at) VALUES (:id, :household_id, 'Main', 'CHECKING', 5, 'EUR', true, "
                "'2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            ),
            {
                "id": uuid4().hex if engine.dialect.name == "sqlite" else uuid4(),
                "household_id": uuid4().hex if engine.dialect.name == "sqlite" else uuid4(),
            },
        )


async def _account_names(engine: AsyncEngine) -> list[str]:
    async with engine.connect() as connection:
        return [row[0] for row in await connection.execute(text("SELECT name FROM accounts"))]


async def test_migrations_build_the_full_schema_on_an_empty_sqlite_database(sqlite_engine: AsyncEngine):
    await run_migrations(sqlite_engine)

    async with sqlite_engine.connect() as connection:
        tables = set(await connection.run_sync(lambda sync: inspect(sync).get_table_names()))
        assert tables == APP_TABLES | {"alembic_version"}
        assert await connection.run_sync(_schema_diff) == []
    assert await _current_revision(sqlite_engine) == _head_revision()


async def test_running_migrations_twice_is_a_no_op(sqlite_engine: AsyncEngine):
    await run_migrations(sqlite_engine)
    await _create_account(sqlite_engine)

    await run_migrations(sqlite_engine)

    assert await _account_names(sqlite_engine) == ["Main"]
    assert await _current_revision(sqlite_engine) == _head_revision()


async def test_legacy_create_all_database_is_stamped_and_keeps_its_data(sqlite_engine: AsyncEngine):
    load_models()
    async with sqlite_engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
    await _create_account(sqlite_engine)

    await run_migrations(sqlite_engine)

    assert await _account_names(sqlite_engine) == ["Main"]
    assert await _current_revision(sqlite_engine) == _head_revision()


async def test_legacy_database_missing_a_table_gets_it_created(sqlite_engine: AsyncEngine):
    load_models()
    async with sqlite_engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
        await connection.execute(text("DROP TABLE audit_logs"))

    await run_migrations(sqlite_engine)

    async with sqlite_engine.connect() as connection:
        assert await connection.run_sync(lambda sync: inspect(sync).has_table("audit_logs"))


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
        # Shape created before transactions.account_id / pot_id carried ondelete="RESTRICT".
        for column, table in (("account_id", "accounts"), ("pot_id", "pots")):
            name = f"transactions_{column}_fkey"
            await connection.execute(text(f"ALTER TABLE transactions DROP CONSTRAINT {name}"))
            await connection.execute(
                text(f"ALTER TABLE transactions ADD CONSTRAINT {name} FOREIGN KEY ({column}) REFERENCES {table} (id)")
            )
        assert await connection.run_sync(_schema_diff) != []
    await _create_account(postgres_engine)

    await run_migrations(postgres_engine)

    assert await _account_names(postgres_engine) == ["Main"]
    async with postgres_engine.connect() as connection:
        assert await connection.run_sync(_schema_diff) == []


@requires_postgres
async def test_concurrent_startups_serialize_on_the_advisory_lock(postgres_engine: AsyncEngine):
    await asyncio.gather(*(run_migrations(postgres_engine) for _ in range(4)))

    assert await _current_revision(postgres_engine) == _head_revision()
    async with postgres_engine.connect() as connection:
        assert await connection.run_sync(_schema_diff) == []
