"""Unit tests for Library database models."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import (
    Item,
    LendingRecord,
    LendingStatus,
    Location,
    MediaType,
    ProviderSubscription,
)


@pytest.fixture
async def async_session():
    """Provides an in-memory SQLite async session for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_location_hierarchy(async_session: AsyncSession):
    """Test parent-child relationship for hierarchical locations."""
    household_id = uuid.uuid4()

    living_room = Location(household_id=household_id, name="Living Room")
    async_session.add(living_room)
    await async_session.commit()
    await async_session.refresh(living_room)

    bookshelf = Location(
        household_id=household_id,
        name="Main Bookshelf",
        parent_id=living_room.id,
    )
    async_session.add(bookshelf)
    await async_session.commit()

    result = await async_session.exec(select(Location).where(Location.id == living_room.id))
    fetched_parent = result.first()
    assert fetched_parent is not None
    assert fetched_parent.name == "Living Room"

    children_result = await async_session.exec(select(Location).where(Location.parent_id == living_room.id))
    children = children_result.all()
    assert len(children) == 1
    assert children[0].name == "Main Bookshelf"


@pytest.mark.asyncio
async def test_item_creation_and_relationships(async_session: AsyncSession):
    """Test Item creation, media types, and location relationship."""
    household_id = uuid.uuid4()

    location = Location(household_id=household_id, name="Game Shelf")
    provider = ProviderSubscription(
        household_id=household_id,
        provider_name="Xbox Game Pass",
        provider_type="GAMING_PASS",
    )
    async_session.add(location)
    async_session.add(provider)
    await async_session.commit()
    await async_session.refresh(location)
    await async_session.refresh(provider)

    game_item = Item(
        household_id=household_id,
        location_id=location.id,
        provider_id=provider.id,
        title="Catan",
        media_type=MediaType.GAME,
        min_players=3,
        max_players=4,
        runtime_minutes=60,
        status=LendingStatus.AVAILABLE,
    )
    async_session.add(game_item)
    await async_session.commit()
    await async_session.refresh(game_item)

    assert game_item.id is not None
    assert game_item.title == "Catan"
    assert game_item.media_type == MediaType.GAME
    assert game_item.is_cookbook is False

    loc_res = await async_session.exec(select(Location).where(Location.id == game_item.location_id))
    loc = loc_res.first()
    assert loc is not None
    assert loc.name == "Game Shelf"

    prov_res = await async_session.exec(
        select(ProviderSubscription).where(ProviderSubscription.id == game_item.provider_id)
    )
    prov = prov_res.first()
    assert prov is not None
    assert prov.provider_name == "Xbox Game Pass"


@pytest.mark.asyncio
async def test_lending_record_relationship(async_session: AsyncSession):
    """Test LendingRecord creation and association with an Item."""
    household_id = uuid.uuid4()

    book = Item(
        household_id=household_id,
        title="Clean Code",
        media_type=MediaType.BOOK,
        author_creator="Robert C. Martin",
    )
    async_session.add(book)
    await async_session.commit()
    await async_session.refresh(book)

    lending_record = LendingRecord(
        household_id=household_id,
        item_id=book.id,
        contact_name="Alice",
        status=LendingStatus.LENT_OUT,
        notes="Borrowed for 2 weeks",
    )
    book.status = LendingStatus.LENT_OUT
    async_session.add(lending_record)
    async_session.add(book)
    await async_session.commit()

    result = await async_session.exec(select(Item).where(Item.id == book.id))
    fetched_book = result.first()
    assert fetched_book is not None
    assert fetched_book.status == LendingStatus.LENT_OUT

    lending_res = await async_session.exec(select(LendingRecord).where(LendingRecord.item_id == book.id))
    lending_records = lending_res.all()
    assert len(lending_records) == 1
    assert lending_records[0].contact_name == "Alice"
