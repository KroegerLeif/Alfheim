from datetime import date, timedelta
from unittest.mock import patch

import pytest
from app.features.devices.models import Device, Household
from app.features.tasks.models import MaintenanceStep
from app.features.tasks.schemas import MaintenanceSubmission, TaskStateUpdate
from app.features.tasks.service import TaskService
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
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
async def test_get_overdue_tasks_and_update(db_session_isolated: AsyncSession):
    db_session = db_session_isolated
    h1 = Household(name="Townhouse")
    db_session.add(h1)
    await db_session.commit()
    await db_session.refresh(h1)

    d1 = Device(
        name="Water Heater",
        model="WH-300",
        serial="SN789",
        category="water",
        location="basement",
        status="active",
        household_id=h1.id,
    )
    db_session.add(d1)
    await db_session.commit()
    await db_session.refresh(d1)

    past_date = (date.today() - timedelta(days=10)).isoformat()
    s1 = MaintenanceStep(title="Flush Tank", recurrence=12, device_id=d1.id, supply_needed_date=past_date)
    db_session.add(s1)
    await db_session.commit()
    await db_session.refresh(s1)

    # Test Overdue Tasks
    overdue = await TaskService.get_overdue_tasks(db_session)
    assert len(overdue) >= 1
    target = next((x for x in overdue if x["step_id"] == s1.id), None)
    assert target is not None
    assert target["days_overdue"] == 10

    # Test Update Task State
    new_date = (date.today() + timedelta(days=30)).isoformat()
    update_payload = TaskStateUpdate(supply_needed_date=new_date, comment="Deferred")
    updated_step = await TaskService.update_task_state(db_session, s1.id, update_payload)
    assert updated_step.supply_needed_date == new_date
    assert updated_step.description == "Deferred"

    # Should no longer be overdue
    overdue_now = await TaskService.get_overdue_tasks(db_session)
    assert not any(x["step_id"] == s1.id for x in overdue_now)


@pytest.mark.asyncio
async def test_submit_maintenance_wizard_and_history(db_session_isolated: AsyncSession):
    db_session = db_session_isolated
    h1 = Household(name="Condo")
    db_session.add(h1)
    await db_session.commit()
    await db_session.refresh(h1)

    d1 = Device(
        name="Dehumidifier",
        model="DH-400",
        serial="SN012",
        category="air",
        location="closet",
        status="active",
        household_id=h1.id,
    )
    db_session.add(d1)
    await db_session.commit()
    await db_session.refresh(d1)

    s1 = MaintenanceStep(title="Clean Coil", recurrence=6, device_id=d1.id)
    db_session.add(s1)
    await db_session.commit()
    await db_session.refresh(s1)

    payload = MaintenanceSubmission(
        device_id=d1.id,
        performer="Alice",
        step_notes="All clean",
        completed_step_ids=[s1.id],
        supply_items=["Coil Cleaner"],
    )

    with patch("app.features.tasks.service.TaskService.forward_supplies_to_shopping") as mock_forward:
        event = await TaskService.submit_maintenance_wizard(db_session, payload)
        assert event.performer == "Alice"
        assert "Clean Coil" in event.completed_steps
        mock_forward.assert_called_once_with(["Coil Cleaner"])

    # Test Get History
    history = await TaskService.get_history(db_session, household_id=h1.id)
    assert len(history) == 1
    assert history[0].device_name == "Dehumidifier"
    assert history[0].notes == "All clean"
