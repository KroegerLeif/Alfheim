import uuid
from datetime import date

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.models import (
    ChoreInstance,
    ChoreTemplate,
)
from src.features.chore_management.schemas import (
    ChoreAssignRequest,
    ChoreTemplateUpdate,
)
from src.features.chore_management.service import ChoreService


@pytest.mark.asyncio
async def test_update_chore_template(db_session: AsyncSession):
    home_id = uuid.uuid4()
    t1 = ChoreTemplate(
        name="Clean Kitchen", description="Wipe counters", recurrence="daily", points=10, home_id=home_id
    )
    db_session.add(t1)
    await db_session.commit()
    await db_session.refresh(t1)

    update_data = ChoreTemplateUpdate(name="Clean Kitchen 2", points=20)
    updated = await ChoreService.update_chore_template(db_session, t1.id, update_data, home_id)
    assert updated.name == "Clean Kitchen 2"
    assert updated.points == 20


@pytest.mark.asyncio
async def test_delete_chore_template(db_session: AsyncSession):
    home_id = uuid.uuid4()
    t1 = ChoreTemplate(name="Clean Kitchen", recurrence="daily", points=10, home_id=home_id)
    db_session.add(t1)
    await db_session.commit()
    await db_session.refresh(t1)

    res = await ChoreService.delete_chore_template(db_session, t1.id, home_id)
    assert res is True

    # get_chore_template returns None if not found, it doesn't raise
    template = await ChoreService.get_chore_template(db_session, t1.id, home_id)
    assert template is None


@pytest.mark.asyncio
async def test_assign_and_complete_chore_instance(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    today = date.today()

    # 1. Create a template
    t1 = ChoreTemplate(name="Vacuum", recurrence="daily", points=15, home_id=home_id)
    db_session.add(t1)
    await db_session.commit()
    await db_session.refresh(t1)

    # 2. Get today chores (this should trigger self healing generation)
    chores = await ChoreService.get_today_chores(db_session, home_id, today)
    assert len(chores) == 1
    inst = chores[0]

    # 3. Assign
    assigned = await ChoreService.assign_chore_instance(
        db_session, inst.id, ChoreAssignRequest(assigned_to=user_id), home_id
    )
    assert assigned.assigned_to == user_id

    # 4. Complete
    completed = await ChoreService.complete_chore_instance(db_session, inst.id, user_id, home_id, "User A")
    assert completed.status == "completed"
    assert completed.points_awarded == 15

    # 5. Check timeline history
    timeline = await ChoreService.get_task_timeline(db_session, t1.id, home_id)
    assert len(timeline) == 1
    assert timeline[0].completed_by == user_id

    # 6. Check integrations summary
    summary = await ChoreService.get_integrations_summary(db_session, home_id)
    assert summary["today_completed_count"] == 1
    assert summary["today_pending_count"] == 0
    assert summary["current_streak"] == 1


@pytest.mark.asyncio
async def test_run_nightly_reset(db_session: AsyncSession):
    home_id = uuid.uuid4()
    t1 = ChoreTemplate(name="Trash", recurrence="daily", points=5, home_id=home_id)
    db_session.add(t1)
    await db_session.commit()
    await db_session.refresh(t1)

    target_date = date.today()
    await ChoreService.run_nightly_reset_for_all(db_session, target_date)

    stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.due_date == target_date)
    res = await db_session.exec(stmt)
    instances = res.all()
    assert len(instances) == 1
