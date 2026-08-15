from datetime import date, timedelta

import pytest
from app.features.devices.models import Device, Household
from app.features.maintenance.exceptions import WizardValidationError
from app.features.maintenance.schemas import WizardSessionPayload, WizardStepEntry
from app.features.maintenance.service import MaintenanceService
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest.fixture
async def db_session_isolated():
    async with SessionLocal() as session:
        yield session


@pytest.mark.asyncio
async def test_maintenance_summary_and_wizard(db_session_isolated: AsyncSession):
    # 1. Create Household and Device
    db_session = db_session_isolated
    h1 = Household(name="Lake House")
    db_session.add(h1)
    await db_session.commit()
    await db_session.refresh(h1)

    d1 = Device(
        name="HVAC",
        model="AC-100",
        serial="SN123",
        category="climate",
        location="basement",
        status="active",
        household_id=h1.id,
    )
    db_session.add(d1)
    await db_session.commit()
    await db_session.refresh(d1)

    # 2. Add Steps
    past_date = (date.today() - timedelta(days=5)).isoformat()
    s1 = MaintenanceStep(title="Replace Filter", recurrence=3, device_id=d1.id, supply_needed_date=past_date)
    future_date = (date.today() + timedelta(days=20)).isoformat()
    s2 = MaintenanceStep(title="Check Belts", recurrence=12, device_id=d1.id, supply_needed_date=future_date)

    db_session.add(s1)
    db_session.add(s2)
    await db_session.commit()
    await db_session.refresh(s1)
    await db_session.refresh(s2)

    # 3. Check Summary
    summaries = await MaintenanceService.get_maintenance_summary(db_session, household_id=h1.id)
    assert len(summaries) == 1
    assert summaries[0].total_overdue == 1  # s1 is overdue
    assert summaries[0].total_ok == 1  # s2 is ok (20 days > 14 days)

    # 4. Submit Wizard Session (Completing s1)
    payload = WizardSessionPayload(
        device_id=d1.id,
        performer="John",
        session_notes="Filter replaced.",
        completed_steps=[WizardStepEntry(step_id=s1.id, comment="Used generic brand")],
        supply_items_to_order=[],
    )
    result = await MaintenanceService.submit_wizard_session(db_session, payload)
    assert result.completed_step_count == 1

    # Verify DB update
    await db_session.refresh(s1)
    # The new supply needed date should be in the future (approx 3 months from today)
    assert s1.supply_needed_date > date.today().isoformat()

    # Verify History Event
    stmt = select(ServiceHistoryEvent).where(ServiceHistoryEvent.device_id == d1.id)
    res = await db_session.exec(stmt)
    history = list(res.all())
    assert len(history) == 1
    assert history[0].notes == "Filter replaced."
    assert "Replace Filter" in history[0].completed_steps


@pytest.mark.asyncio
async def test_wizard_validation_error(db_session_isolated: AsyncSession):
    db_session = db_session_isolated
    h1 = Household(name="House")
    db_session.add(h1)
    await db_session.commit()
    await db_session.refresh(h1)

    d1 = Device(
        name="Pump",
        model="P-200",
        serial="SN456",
        category="water",
        location="yard",
        status="active",
        household_id=h1.id,
    )
    db_session.add(d1)
    await db_session.commit()
    await db_session.refresh(d1)

    payload = WizardSessionPayload(
        device_id=d1.id,
        performer="Jane",
        completed_steps=[WizardStepEntry(step_id=9999)],  # Invalid step ID
    )

    with pytest.raises(WizardValidationError):
        await MaintenanceService.submit_wizard_session(db_session, payload)
