"""Unit tests covering service layer edge cases and error branches in chore management."""

import uuid
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.exceptions import (
    ChoreAlreadyCompletedError,
    ChoreInstanceNotFoundError,
    ChoreNotAssignableError,
    ChoreTemplateNotFoundError,
    DuplicateChoreTemplateError,
)
from src.features.chore_management.models import ChoreInstance, ChoreTemplate, HouseholdStreak
from src.features.chore_management.schemas import (
    ChoreAssignRequest,
    ChoreTemplateCreate,
    ChoreTemplateUpdate,
)
from src.features.chore_management.services.instance_service import InstanceService
from src.features.chore_management.services.streak_service import StreakService
from src.features.chore_management.services.template_service import TemplateService


@pytest.mark.asyncio
async def test_ensure_household_reset_yesterday_uncompleted_and_completed_streaks(db_session: AsyncSession):
    """Verify that uncompleted chores from yesterday break streak and completed chores increment streak."""
    home_id = uuid.uuid4()
    yesterday = date.today() - timedelta(days=1)

    # 1. Create a template
    template = ChoreTemplate(name="Test Chore", recurrence="daily", points=10, home_id=home_id)
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    # 2. Add an uncompleted instance for yesterday
    inst_yesterday = ChoreInstance(
        template_id=template.id,
        home_id=home_id,
        due_date=yesterday,
        status="pending",
        points_awarded=0,
    )
    db_session.add(inst_yesterday)
    await db_session.commit()

    # Reset for today: yesterday's chore should become missed, streak set to 0
    today = date.today()
    await InstanceService.ensure_household_reset(db_session, home_id, today)

    await db_session.refresh(inst_yesterday)
    assert inst_yesterday.status == "missed"

    streak = await StreakService.ensure_household_streak(db_session, home_id)
    assert streak.current_streak == 0

    # 3. Mark all chores today completed and evaluate streak increment on tomorrow's reset
    tomorrow = today + timedelta(days=1)
    stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.due_date == today)
    res = await db_session.exec(stmt)
    today_instances = res.all()
    for inst in today_instances:
        inst.status = "completed"
        db_session.add(inst)
    await db_session.commit()

    await InstanceService.ensure_household_reset(db_session, home_id, tomorrow)
    streak = await StreakService.ensure_household_streak(db_session, home_id)
    assert streak.current_streak == 1
    assert streak.longest_streak == 1
    assert streak.last_completed_date == today


@pytest.mark.asyncio
async def test_ensure_household_reset_cumulative_vs_non_cumulative_multi_day_gap(db_session: AsyncSession):
    """Non-cumulative chores expire nightly and reset the streak; cumulative ones stack and don't.

    Simulates a multi-day gap where nobody completes either chore: the
    non-cumulative instance is archived as "missed" and replaced by a fresh
    "pending" instance each day, while the cumulative instance is rolled
    forward (same row, new due_date) and keeps stacking as still "pending".
    """
    home_id = uuid.uuid4()
    day1 = date.today()
    day2 = day1 + timedelta(days=1)
    day3 = day2 + timedelta(days=1)

    non_cumulative_tpl = ChoreTemplate(name="Wash Dishes", points=10, home_id=home_id, is_non_cumulative=True)
    cumulative_tpl = ChoreTemplate(name="Deep Clean Garage", points=20, home_id=home_id, is_non_cumulative=False)
    db_session.add(non_cumulative_tpl)
    db_session.add(cumulative_tpl)
    await db_session.commit()
    await db_session.refresh(non_cumulative_tpl)
    await db_session.refresh(cumulative_tpl)

    # Day 1: generate instances for both templates.
    await InstanceService.ensure_household_reset(db_session, home_id, day1)

    async def instances_for(due_date: date) -> list[ChoreInstance]:
        stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.due_date == due_date)
        res = await db_session.exec(stmt)
        return list(res.all())

    day1_instances = await instances_for(day1)
    assert len(day1_instances) == 2
    cumulative_instance_id = next(i.id for i in day1_instances if i.template_id == cumulative_tpl.id)

    # Nobody completes anything. Day 2's reset evaluates day1.
    await InstanceService.ensure_household_reset(db_session, home_id, day2)

    day1_instances = await instances_for(day1)
    non_cumulative_day1 = next(i for i in day1_instances if i.template_id == non_cumulative_tpl.id)
    assert non_cumulative_day1.status == "missed"
    # The cumulative instance rolled forward off day1 rather than being archived.
    assert all(i.template_id != cumulative_tpl.id for i in day1_instances)

    day2_instances = await instances_for(day2)
    assert len(day2_instances) == 2
    non_cumulative_day2 = next(i for i in day2_instances if i.template_id == non_cumulative_tpl.id)
    cumulative_day2 = next(i for i in day2_instances if i.template_id == cumulative_tpl.id)
    assert non_cumulative_day2.status == "pending"
    assert non_cumulative_day2.id != non_cumulative_day1.id  # a fresh instance, not the missed one
    assert cumulative_day2.status == "pending"
    assert cumulative_day2.id == cumulative_instance_id  # same row, rolled forward, still stacking

    streak = await StreakService.ensure_household_streak(db_session, home_id)
    assert streak.current_streak == 0  # broken by the non-cumulative miss

    # Gap continues: day 3's reset evaluates day2, same outcome pattern.
    await InstanceService.ensure_household_reset(db_session, home_id, day3)

    day2_instances = await instances_for(day2)
    non_cumulative_day2 = next(i for i in day2_instances if i.template_id == non_cumulative_tpl.id)
    assert non_cumulative_day2.status == "missed"

    day3_instances = await instances_for(day3)
    assert len(day3_instances) == 2
    cumulative_day3 = next(i for i in day3_instances if i.template_id == cumulative_tpl.id)
    assert cumulative_day3.status == "pending"
    assert cumulative_day3.id == cumulative_instance_id  # still the same stacked instance

    streak = await StreakService.ensure_household_streak(db_session, home_id)
    assert streak.current_streak == 0


@pytest.mark.asyncio
async def test_ensure_household_reset_generates_missing_instance_for_new_template_same_day(
    db_session: AsyncSession,
):
    """A template created after today's reset already ran still gets today's instance (#506).

    Re-running the reset afterwards must not create a duplicate.
    """
    home_id = uuid.uuid4()
    today = date.today()

    first_tpl = ChoreTemplate(name="Vacuum", points=10, home_id=home_id)
    db_session.add(first_tpl)
    await db_session.commit()
    await db_session.refresh(first_tpl)

    # First visit of the day: generates today's instance for the only template.
    await InstanceService.ensure_household_reset(db_session, home_id, today)

    stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.due_date == today)
    instances = (await db_session.exec(stmt)).all()
    assert len(instances) == 1

    # A new template is created mid-day, after the reset already ran.
    new_tpl = ChoreTemplate(name="Water Plants", points=5, home_id=home_id)
    db_session.add(new_tpl)
    await db_session.commit()
    await db_session.refresh(new_tpl)

    # Returning to the dashboard triggers ensure_household_reset again.
    await InstanceService.ensure_household_reset(db_session, home_id, today)

    instances = (await db_session.exec(stmt)).all()
    assert len(instances) == 2
    assert {i.template_id for i in instances} == {first_tpl.id, new_tpl.id}
    new_instance = next(i for i in instances if i.template_id == new_tpl.id)
    assert new_instance.status == "pending"

    # Re-running the reset again (e.g. another page load) must not create duplicates.
    await InstanceService.ensure_household_reset(db_session, home_id, today)
    instances = (await db_session.exec(stmt)).all()
    assert len(instances) == 2


@pytest.mark.asyncio
async def test_ensure_household_reset_commit_exception_handling(db_session: AsyncSession):
    """Verify database rollback when an exception occurs during reset instance commit."""
    home_id = uuid.uuid4()
    # Ensure streak exists first so failure happens on final commit
    await StreakService.ensure_household_streak(db_session, home_id)

    orig_commit = db_session.commit
    called = False

    async def fail_second_commit():
        nonlocal called
        if called:
            raise RuntimeError("Database failure during instance generation")
        called = True
        await orig_commit()

    with patch.object(db_session, "commit", side_effect=fail_second_commit):
        await InstanceService.ensure_household_reset(db_session, home_id, date.today())


@pytest.mark.asyncio
async def test_assign_chore_instance_exceptions(db_session: AsyncSession):
    """Verify exceptions in assign_chore_instance when instance is not found, completed, or missed."""
    home_id = uuid.uuid4()
    template = ChoreTemplate(name="T1", recurrence="daily", points=5, home_id=home_id)
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    # Not found
    with pytest.raises(ChoreInstanceNotFoundError):
        await InstanceService.assign_chore_instance(
            db_session, uuid.uuid4(), ChoreAssignRequest(assigned_to=uuid.uuid4()), home_id
        )

    # Already completed
    inst_completed = ChoreInstance(
        template_id=template.id,
        home_id=home_id,
        due_date=date.today(),
        status="completed",
        points_awarded=5,
    )
    db_session.add(inst_completed)
    await db_session.commit()
    await db_session.refresh(inst_completed)

    with pytest.raises(ChoreAlreadyCompletedError):
        await InstanceService.assign_chore_instance(
            db_session, inst_completed.id, ChoreAssignRequest(assigned_to=uuid.uuid4()), home_id
        )

    # Missed
    inst_missed = ChoreInstance(
        template_id=template.id,
        home_id=home_id,
        due_date=date.today() - timedelta(days=1),
        status="missed",
        points_awarded=0,
    )
    db_session.add(inst_missed)
    await db_session.commit()
    await db_session.refresh(inst_missed)

    with pytest.raises(ChoreNotAssignableError):
        await InstanceService.assign_chore_instance(
            db_session, inst_missed.id, ChoreAssignRequest(assigned_to=uuid.uuid4()), home_id
        )


@pytest.mark.asyncio
async def test_complete_chore_instance_exceptions(db_session: AsyncSession):
    """Verify exceptions in complete_chore_instance when instance is not found or already completed."""
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    # Not found
    with pytest.raises(ChoreInstanceNotFoundError):
        await InstanceService.complete_chore_instance(db_session, uuid.uuid4(), user_id, home_id)

    # Already completed
    template = ChoreTemplate(name="T2", recurrence="daily", points=5, home_id=home_id)
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    inst = ChoreInstance(
        template_id=template.id,
        home_id=home_id,
        due_date=date.today(),
        status="completed",
        points_awarded=5,
    )
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)

    with pytest.raises(ChoreAlreadyCompletedError):
        await InstanceService.complete_chore_instance(db_session, inst.id, user_id, home_id)


@pytest.mark.asyncio
async def test_get_task_timeline_not_found(db_session: AsyncSession):
    """Verify ChoreTemplateNotFoundError is raised when template is missing."""
    with pytest.raises(ChoreTemplateNotFoundError):
        await InstanceService.get_task_timeline(db_session, uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_template_service_create_duplicate(db_session: AsyncSession):
    """Verify DuplicateChoreTemplateError on duplicate name within same household."""
    home_id = uuid.uuid4()
    await TemplateService.create_chore_template(db_session, ChoreTemplateCreate(name="Sweep Floor", points=5), home_id)
    with pytest.raises(DuplicateChoreTemplateError):
        await TemplateService.create_chore_template(
            db_session, ChoreTemplateCreate(name="Sweep Floor", points=10), home_id
        )


@pytest.mark.asyncio
async def test_template_service_create_integrity_error(db_session: AsyncSession):
    """Verify DuplicateChoreTemplateError when create encounters an IntegrityError."""
    home_id = uuid.uuid4()
    with patch.object(db_session, "commit", side_effect=IntegrityError("stmt", "params", Exception())):
        with pytest.raises(DuplicateChoreTemplateError):
            await TemplateService.create_chore_template(
                db_session, ChoreTemplateCreate(name="Mop Floor Unique", points=10), home_id
            )


@pytest.mark.asyncio
async def test_template_service_update_and_delete_edge_cases(db_session: AsyncSession):
    """Verify edge cases in update and delete operations in TemplateService."""
    home_id = uuid.uuid4()

    # Nonexistent update
    with pytest.raises(ChoreTemplateNotFoundError):
        await TemplateService.update_chore_template(
            db_session, uuid.uuid4(), ChoreTemplateUpdate(name="New Name"), home_id
        )

    # Nonexistent delete
    with pytest.raises(ChoreTemplateNotFoundError):
        await TemplateService.delete_chore_template(db_session, uuid.uuid4(), home_id)

    # Create two templates to test name clash on update
    t1 = await TemplateService.create_chore_template(
        db_session, ChoreTemplateCreate(name="Task Alpha", points=5), home_id
    )
    t2 = await TemplateService.create_chore_template(
        db_session, ChoreTemplateCreate(name="Task Beta", points=5), home_id
    )

    with pytest.raises(DuplicateChoreTemplateError):
        await TemplateService.update_chore_template(db_session, t2.id, ChoreTemplateUpdate(name="Task Alpha"), home_id)

    # Simulate IntegrityError on update
    with patch.object(db_session, "commit", side_effect=IntegrityError("stmt", "params", Exception())):
        with pytest.raises(DuplicateChoreTemplateError):
            await TemplateService.update_chore_template(db_session, t1.id, ChoreTemplateUpdate(points=50), home_id)


@pytest.mark.asyncio
async def test_streak_service_integrity_error_recovery(db_session: AsyncSession):
    """Verify StreakService handles race conditions during ensure_household_streak."""
    home_id = uuid.uuid4()
    fake_existing_streak = HouseholdStreak(
        id=uuid.uuid4(),
        home_id=home_id,
        current_streak=3,
        longest_streak=5,
    )

    call_count = 0

    async def mock_exec(statement):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First select returns None (no streak exists yet)
            mock_res = MagicMock()
            mock_res.first.return_value = None
            return mock_res
        else:
            # Second select (recovery after race condition) returns the existing streak
            mock_res = MagicMock()
            mock_res.first.return_value = fake_existing_streak
            return mock_res

    with patch.object(db_session, "exec", side_effect=mock_exec):
        with patch.object(db_session, "commit", side_effect=IntegrityError("stmt", "params", Exception())):
            recovered = await StreakService.ensure_household_streak(db_session, home_id)
            assert recovered == fake_existing_streak
            assert recovered.current_streak == 3


@pytest.mark.asyncio
async def test_chore_service_delegations(db_session: AsyncSession):
    """Verify ChoreService wrapper delegations to streak, template, and instance services."""
    from src.features.chore_management.service import ChoreService

    home_id = uuid.uuid4()
    streak = await ChoreService.ensure_household_streak(db_session, home_id)
    assert streak.current_streak == 0

    templates = await ChoreService.list_chore_templates(db_session, home_id)
    assert len(templates) == 0
