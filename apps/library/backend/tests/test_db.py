"""Unit tests for database module and session initialization."""

from unittest.mock import patch

import pytest
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.database import get_db_session, init_db


@pytest.mark.asyncio
async def test_init_db():
    """Test table creation in init_db."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    with patch("src.db.database.engine", test_engine):
        await init_db()

        async with test_engine.connect() as conn:
            tables = await conn.run_sync(lambda sync_conn: sync_conn.dialect.get_table_names(sync_conn))
            assert "locations" in tables
            assert "items" in tables
            assert "lending_records" in tables
            assert "provider_subscriptions" in tables

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_get_db_session():
    """Test get_db_session yields an active AsyncSession."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    with patch("src.db.database.engine", test_engine):
        async for session in get_db_session():
            assert isinstance(session, AsyncSession)
            assert session.is_active

    await test_engine.dispose()
