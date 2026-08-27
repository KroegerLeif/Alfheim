import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.core.dependencies import UserHomeContext, get_current_user_and_home
from src.features.session import service
from src.features.session.models import SessionStatus
from src.features.session.schemas import (
    SessionSetSyncRequest,
    SessionSetSyncResponse,
    StartSessionRequest,
    WorkoutSessionRead,
)

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


@router.post("", response_model=WorkoutSessionRead, status_code=status.HTTP_201_CREATED)
async def start_session(
    payload: StartSessionRequest,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Start a new workout session, optionally cloned from a plan day's current state."""
    return await service.start_session(session, context.home_id, context.user_id, payload.plan_id, payload.plan_day_id)


@router.get("", response_model=list[WorkoutSessionRead])
async def list_sessions(
    status_filter: SessionStatus | None = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List the caller's own workout sessions, optionally filtered by status."""
    return await service.list_sessions(session, context.home_id, context.user_id, status_filter, limit, offset)


@router.get("/{session_id}", response_model=WorkoutSessionRead)
async def get_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve a single workout session by ID."""
    workout_session = await service.get_session(session, session_id, context.home_id, context.user_id)
    if not workout_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return workout_session


@router.post("/{session_id}/complete", response_model=WorkoutSessionRead)
async def complete_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Mark an active session as completed."""
    workout_session = await service.complete_session(session, session_id, context.home_id, context.user_id)
    if not workout_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return workout_session


@router.post("/{session_id}/abandon", response_model=WorkoutSessionRead)
async def abandon_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Mark an active session as abandoned."""
    workout_session = await service.abandon_session(session, session_id, context.home_id, context.user_id)
    if not workout_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return workout_session


@router.post("/{session_id}/sets/sync", response_model=SessionSetSyncResponse)
async def sync_sets(
    session_id: uuid.UUID,
    payload: SessionSetSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Upsert a batch of offline-recorded sets by client idempotency key.

    Safe to re-POST the same batch after a flaky retry: already-acked keys are
    returned again without creating duplicate rows.
    """
    acked, server_ids = await service.sync_sets(session, session_id, context.home_id, context.user_id, payload.items)
    return SessionSetSyncResponse(acked=acked, server_ids=server_ids)
