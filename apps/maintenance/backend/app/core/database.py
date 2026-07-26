from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.features.devices.models import Household, Device
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent

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


async def seed_database(session: AsyncSession) -> None:
    """Seeds the database with mockup device and maintenance data."""
    # 1. Create Households
    h1 = Household(name="Zurich Apartment", address="Bahnhofstrasse 12, Zurich")
    h2 = Household(name="Weekend Cottage", address="Lake view path 4, Lucerne")
    session.add(h1)
    session.add(h2)
    await session.commit()
    await session.refresh(h1)
    await session.refresh(h2)

    # 2. Create Devices for Zurich Apartment
    d1 = Device(
        name="Dyson Air Purifier",
        model="Pure Cool Link TP02",
        serial="DY-90812-AP",
        category="Appliances",
        location="Living Room",
        status="active",
        service_interval_months=6,
        notes="Filters need regular vacuuming",
        household_id=h1.id,
    )
    d2 = Device(
        name="Water Softener System",
        model="EcoWater ESD2752",
        serial="EW-87291-WS",
        category="Plumbing",
        location="Utility Room",
        status="active",
        service_interval_months=2,
        notes="Main water softener for the house",
        household_id=h1.id,
    )
    session.add(d1)
    session.add(d2)
    await session.commit()
    await session.refresh(d1)
    await session.refresh(d2)

    # Add steps for Dyson
    s1 = MaintenanceStep(
        title="Vacuum air filter meshes",
        description="Remove filter cover and gently vacuum meshes.",
        recurrence=2,
        supply_item="Microfiber Cloth",
        supply_needed_date="2026-09-01",
        last_completed="2026-07-01",
        device_id=d1.id,
    )
    s2 = MaintenanceStep(
        title="Replace HEPA filter",
        description="Insert brand new HEPA filter insert.",
        recurrence=12,
        supply_item="Dyson TP02 HEPA Filter",
        supply_needed_date="2027-01-10",
        last_completed="2026-01-10",
        device_id=d1.id,
    )
    session.add(s1)
    session.add(s2)

    # Add steps for Water Softener
    s3 = MaintenanceStep(
        title="Refill salt pellets",
        description="Open lid and pour in 25kg eco salt bag.",
        recurrence=2,
        supply_item="EcoWater Salt Bags (25kg)",
        supply_needed_date="2026-08-15",
        last_completed="2026-06-15",
        device_id=d2.id,
    )
    s4 = MaintenanceStep(
        title="Sanitize system",
        description="Run system cleaning fluid through bypass cycle.",
        recurrence=12,
        supply_item="System Disinfectant Pack",
        supply_needed_date="2027-05-01",
        last_completed="2026-05-01",
        device_id=d2.id,
    )
    session.add(s3)
    session.add(s4)

    # Add history event for Dyson
    e1 = ServiceHistoryEvent(
        date="2026-07-01",
        performer="Lena Müller",
        notes="Vacuumed filters and wiped dust off casing.",
        device_id=d1.id,
        completed_steps=["Vacuum air filter meshes"]
    )
    session.add(e1)

    # 3. Create Devices for Weekend Cottage
    d3 = Device(
        name="Roborock Vacuum Cleaner",
        model="Roborock S7 MaxV Ultra",
        serial="RR-09123-VAC",
        category="Appliances",
        location="Main Hallway",
        status="active",
        service_interval_months=3,
        notes="Self-emptying robot vacuum",
        household_id=h2.id,
    )
    d4 = Device(
        name="Air Compressor",
        model="Stanley D200/10/24",
        serial="ST-0918-COMP",
        category="Electrical",
        location="Garage",
        status="maintenance",
        service_interval_months=12,
        notes="High pressure compressor for tools",
        household_id=h2.id,
    )
    session.add(d3)
    session.add(d4)
    await session.commit()
    await session.refresh(d3)
    await session.refresh(d4)

    # Add steps for Roborock
    s5 = MaintenanceStep(
        title="Clean main brush & sensors",
        description="Clear hair from roll brush and wipe optical sensors.",
        recurrence=1,
        supply_item="Brush Cleaner Tool",
        supply_needed_date="2026-08-01",
        last_completed="2026-07-01",
        device_id=d3.id,
    )
    s6 = MaintenanceStep(
        title="Empty dustbin bag",
        description="Replace bag inside auto-empty charging station.",
        recurrence=3,
        supply_item="Roborock Disposable Dust Bag",
        supply_needed_date="2026-10-15",
        last_completed="2026-07-15",
        device_id=d3.id,
    )
    session.add(s5)
    session.add(s6)

    # Add steps for Compressor
    s7 = MaintenanceStep(
        title="Drain condensation tank",
        description="Open bottom valve to let accumulated moisture out.",
        recurrence=3,
        supply_item="Drain Valve Cap",
        supply_needed_date="2026-09-01",
        last_completed="2026-06-01",
        device_id=d4.id,
    )
    s8 = MaintenanceStep(
        title="Check pump oil level",
        description="Verify oil level glass is between min/max markers.",
        recurrence=12,
        supply_item="Stanley Compressor Oil",
        supply_needed_date="2026-07-01",
        last_completed="2025-07-01",
        device_id=d4.id,
    )
    session.add(s7)
    session.add(s8)

    # Add history event for Compressor
    e2 = ServiceHistoryEvent(
        date="2026-06-01",
        performer="Alex Becker",
        notes="Drained water from condensation tank.",
        device_id=d4.id,
        completed_steps=["Drain condensation tank"]
    )
    session.add(e2)

    await session.commit()


async def init_db() -> None:
    """Initialize the database tables.

    Imports all models to ensure they register with SQLModel.metadata.
    """
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
