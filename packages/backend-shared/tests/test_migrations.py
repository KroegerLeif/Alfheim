"""Tests for the shared Alembic scaffold (``backend_shared.migrations``) and runner (``backend_shared.db``)."""

from collections.abc import AsyncIterator
from pathlib import Path
from types import SimpleNamespace
from typing import cast

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from backend_shared.db import create_engine_and_session, run_migrations
from backend_shared.migrations import alembic_config, ignore_indexes
from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

INI = "[alembic]\nscript_location = alembic\nprepend_sys_path = .\npath_separator = os\n"

# A minimal backend: one table plus an index created with raw SQL that the metadata does not declare.
ENV = """
from alembic import context
from backend_shared.migrations import ignore_indexes, run_env
from sqlalchemy import Column, Integer, MetaData, String, Table

metadata = MetaData()
Table("widgets", metadata, Column("id", Integer, primary_key=True), Column("name", String(50), nullable=False))
attributes = context.config.attributes
run_env(
    metadata,
    database_url=attributes.get("database_url", "sqlite+aiosqlite://"),
    include_object=ignore_indexes({"ix_widgets_raw"}),
    version_table_schema=attributes.get("version_table_schema"),
)
"""

REVISION = """
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "widgets", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(50), nullable=False)
    )
    op.execute("CREATE INDEX ix_widgets_raw ON widgets (lower(name))")


def downgrade() -> None:
    op.drop_table("widgets")
"""


def _metadata() -> MetaData:
    metadata = MetaData()
    Table("widgets", metadata, Column("id", Integer, primary_key=True), Column("name", String(50), nullable=False))
    return metadata


@pytest.fixture
def backend_dir(tmp_path: Path) -> Path:
    (tmp_path / "alembic.ini").write_text(INI)
    (tmp_path / "alembic" / "versions").mkdir(parents=True)
    (tmp_path / "alembic" / "env.py").write_text(ENV)
    (tmp_path / "alembic" / "versions" / "0001_init.py").write_text(REVISION)
    return tmp_path


def _cli_config(backend_dir: Path, **attributes: str) -> Config:
    config = alembic_config(backend_dir)
    config.attributes.update(database_url=f"sqlite+aiosqlite:///{backend_dir / 'app.db'}", **attributes)
    return config


def _tables(backend_dir: Path) -> set[str]:
    engine = create_engine(f"sqlite:///{backend_dir / 'app.db'}")
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_ignore_indexes_hides_only_the_named_indexes() -> None:
    include = ignore_indexes({"ix_raw"})

    assert include(None, "ix_raw", "index", True, None) is False
    assert include(None, "ix_other", "index", True, None) is True
    assert include(None, "ix_raw", "table", True, None) is True


def test_alembic_config_points_at_the_backend_and_binds_the_connection(backend_dir: Path) -> None:
    sentinel = object()

    unbound = alembic_config(backend_dir)
    bound = alembic_config(backend_dir, cast(Connection, sentinel))

    assert unbound.config_file_name == str(backend_dir / "alembic.ini")
    assert unbound.get_main_option("script_location") == str(backend_dir / "alembic")
    assert "connection" not in unbound.attributes
    assert bound.attributes["connection"] is sentinel


def test_cli_upgrade_uses_a_dedicated_engine_and_check_ignores_raw_indexes(backend_dir: Path) -> None:
    config = _cli_config(backend_dir)

    command.upgrade(config, "head")
    command.check(config)

    assert _tables(backend_dir) == {"alembic_version", "widgets"}


def test_cli_upgrade_honours_the_version_table_schema(backend_dir: Path) -> None:
    command.upgrade(_cli_config(backend_dir, version_table_schema="main"), "head")

    assert "alembic_version" in _tables(backend_dir)


def test_offline_upgrade_emits_sql_without_connecting(backend_dir: Path, capsys: pytest.CaptureFixture[str]) -> None:
    command.upgrade(_cli_config(backend_dir), "head", sql=True)

    assert "CREATE TABLE widgets" in capsys.readouterr().out
    assert not (backend_dir / "app.db").exists()


@pytest_asyncio.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    """In-memory database; always disposed, since a leaked aiosqlite thread keeps the test process alive."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    yield engine
    await engine.dispose()


async def _run(engine: AsyncEngine, backend_dir: Path, metadata: MetaData, loaded: list[bool]) -> None:
    await run_migrations(engine, lambda: loaded.append(True), 4_242, backend_dir=backend_dir, metadata=metadata)


@pytest.mark.asyncio
async def test_run_migrations_builds_an_empty_database_and_is_idempotent(
    engine: AsyncEngine, backend_dir: Path
) -> None:
    metadata, loaded = _metadata(), []

    await _run(engine, backend_dir, metadata, loaded)
    await _run(engine, backend_dir, metadata, loaded)

    async with engine.connect() as connection:
        tables = set(await connection.run_sync(lambda sync: inspect(sync).get_table_names()))
        version = (await connection.execute(text("SELECT version_num FROM alembic_version"))).scalar_one()
    assert tables == {"alembic_version", "widgets"}
    assert version == "0001"
    assert loaded == [True, True]


@pytest.mark.asyncio
async def test_run_migrations_stamps_a_legacy_create_all_database(engine: AsyncEngine, backend_dir: Path) -> None:
    metadata = _metadata()
    async with engine.begin() as connection:
        await connection.run_sync(metadata.create_all)
        await connection.execute(text("INSERT INTO widgets (id, name) VALUES (1, 'kept')"))

    await _run(engine, backend_dir, metadata, [])

    async with engine.connect() as connection:
        names = (await connection.execute(text("SELECT name FROM widgets"))).scalars().all()
        version = (await connection.execute(text("SELECT version_num FROM alembic_version"))).scalar_one()
    assert names == ["kept"]
    assert version == "0001"


@pytest.mark.asyncio
async def test_create_engine_and_session_uses_the_injected_settings() -> None:
    settings = SimpleNamespace(DATABASE_URL="sqlite+aiosqlite:///:memory:", SQL_ECHO=True)

    engine, session_factory = create_engine_and_session(settings)  # type: ignore[arg-type]

    async with session_factory() as session:
        assert isinstance(session, AsyncSession)
        assert await session.scalar(text("SELECT 1")) == 1
    assert engine.echo is True
    assert session_factory.kw["expire_on_commit"] is False
    await engine.dispose()
