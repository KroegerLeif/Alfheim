import datetime
import uuid

import pytest
from app.features.devices.models import Device
from app.features.maintenance.schemas import WizardSessionPayload
from app.features.tasks.exceptions import StepNotFoundError
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
from app.features.tasks.schemas import MaintenanceSubmission, TaskStateUpdate
from app.features.tasks.service import TaskService
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False})
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

OVERDUE_DATE = (datetime.date.today() - datetime.timedelta(days=3)).isoformat()


@pytest.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest.fixture
async def session():
    async with SessionLocal() as s:
        yield s


async def _seed_household(session: AsyncSession, household_id: uuid.UUID, name: str) -> tuple[Device, MaintenanceStep]:
    device = Device(
        name=name,
        model="M",
        serial=f"SN-{name}",
        category="water",
        location="basement",
        status="active",
        household_id=household_id,
    )
    session.add(device)
    await session.commit()
    await session.refresh(device)
    assert device.id is not None
    step = MaintenanceStep(
        title=f"{name} step",
        description="d",
        recurrence=3,
        last_completed="2020-01-01",
        supply_needed_date=OVERDUE_DATE,
        supply_item="filter",
        device_id=device.id,
    )
    event = ServiceHistoryEvent(
        date="2024-01-01", performer="someone", notes="n", device_id=device.id, completed_steps=[step.title]
    )
    session.add(step)
    session.add(event)
    await session.commit()
    await session.refresh(step)
    return device, step


@pytest.mark.asyncio
async def test_history_and_overdue_only_return_the_callers_household(session: AsyncSession):
    home_a, home_b = uuid.uuid4(), uuid.uuid4()
    await _seed_household(session, home_a, "Heater A")
    await _seed_household(session, home_b, "Heater B")

    history = await TaskService.get_history(session, home_a)
    assert [h.device_name for h in history] == ["Heater A"]

    overdue = await TaskService.get_overdue_tasks(session, home_a)
    assert [o["device_name"] for o in overdue] == ["Heater A"]

    assert await TaskService.get_history(session, uuid.uuid4()) == []
    assert await TaskService.get_overdue_tasks(session, uuid.uuid4()) == []


@pytest.mark.asyncio
async def test_update_task_state_rejects_step_of_other_household(session: AsyncSession):
    home_a, home_b = uuid.uuid4(), uuid.uuid4()
    _, step_b = await _seed_household(session, home_b, "Heater B")
    assert step_b.id is not None

    with pytest.raises(StepNotFoundError):
        await TaskService.update_task_state(session, step_b.id, TaskStateUpdate(comment="hijacked"), home_a)

    await session.refresh(step_b)
    assert step_b.description == "d"

    updated = await TaskService.update_task_state(session, step_b.id, TaskStateUpdate(comment="mine"), home_b)
    assert updated.description == "mine"


def test_supply_items_are_capped():
    too_many = [f"item-{i}" for i in range(51)]
    with pytest.raises(ValidationError):
        MaintenanceSubmission(device_id=1, completed_step_ids=[], performer="x", supply_items=too_many)
    with pytest.raises(ValidationError):
        WizardSessionPayload(device_id=1, performer="x", supply_items_to_order=too_many)
    with pytest.raises(ValidationError):
        MaintenanceSubmission(device_id=1, completed_step_ids=[], performer="x", supply_items=["a" * 201])
    with pytest.raises(ValidationError):
        TaskStateUpdate(comment="c" * 2001)

    ok = MaintenanceSubmission(device_id=1, completed_step_ids=[], performer="x", supply_items=too_many[:50])
    assert ok.supply_items is not None and len(ok.supply_items) == 50
