import uuid

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.session.exceptions import SessionValidationError
from src.features.session.models import SessionStatus
from src.features.session.services.session_lifecycle_service import (
    abandon_session,
    complete_session,
    get_session,
    list_sessions,
    start_session,
)


async def test_start_freeform_session(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()

    workout_session = await start_session(db_session, home_id, user_id)

    assert workout_session.status == SessionStatus.ACTIVE
    assert workout_session.home_id == home_id
    assert workout_session.user_id == user_id


async def test_start_session_requires_both_plan_fields_together(db_session: AsyncSession):
    with pytest.raises(SessionValidationError):
        await start_session(db_session, uuid.uuid4(), uuid.uuid4(), plan_id=uuid.uuid4(), plan_day_id=None)


async def test_complete_session_transitions_status(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)

    completed = await complete_session(db_session, workout_session.id, home_id, user_id)

    assert completed is not None
    assert completed.status == SessionStatus.COMPLETED
    assert completed.completed_at is not None


async def test_complete_already_completed_session_rejected(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)
    await complete_session(db_session, workout_session.id, home_id, user_id)

    with pytest.raises(SessionValidationError):
        await complete_session(db_session, workout_session.id, home_id, user_id)


async def test_abandon_session_transitions_status(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)

    abandoned = await abandon_session(db_session, workout_session.id, home_id, user_id)

    assert abandoned is not None
    assert abandoned.status == SessionStatus.ABANDONED


async def test_get_session_scoped_to_caller(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    workout_session = await start_session(db_session, home_id, user_id)

    assert await get_session(db_session, workout_session.id, home_id, other_user_id) is None
    assert await get_session(db_session, workout_session.id, home_id, user_id) is not None


async def test_list_sessions_filters_by_status(db_session: AsyncSession):
    home_id = uuid.uuid4()
    user_id = uuid.uuid4()
    active = await start_session(db_session, home_id, user_id)
    completed = await start_session(db_session, home_id, user_id)
    await complete_session(db_session, completed.id, home_id, user_id)

    active_only = await list_sessions(db_session, home_id, user_id, status_filter=SessionStatus.ACTIVE)
    assert {s.id for s in active_only} == {active.id}
