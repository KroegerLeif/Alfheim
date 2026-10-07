"""Offline-sync ack logic: upsert-by-idempotency-key so a client can safely
re-POST the same batch of locally-recorded sets after a flaky retry, and so a
set logged offline reconciles to a single server row instead of duplicating.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.session.exceptions import SessionNotActiveError, SessionValidationError
from src.features.session.models import SessionExercise, SessionSet, SessionStatus, WorkoutSession
from src.features.session.schemas import SessionSetSyncItem


async def _find_open_placeholder(
    session: AsyncSession, session_exercise_id: uuid.UUID, set_order: int
) -> SessionSet | None:
    """Return the cloned, not-yet-performed set row for this slot, if the plan day produced one.

    A session started from a plan clones one SessionSet per planned set (no completion
    timestamp, no idempotency key). Logging that slot must fill the clone in rather than add
    a second row, otherwise the planned set keeps showing as open after a reload and gets
    performed twice.
    """
    result = await session.exec(
        select(SessionSet)
        .where(
            SessionSet.session_exercise_id == session_exercise_id,
            SessionSet.set_order == set_order,
            col(SessionSet.completed_at).is_(None),
            col(SessionSet.client_idempotency_key).is_(None),
        )
        .order_by(col(SessionSet.created_at).asc())
    )
    return result.first()


async def sync_sets(
    session: AsyncSession,
    session_id: uuid.UUID,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
    items: list[SessionSetSyncItem],
) -> tuple[list[str], dict[str, uuid.UUID]]:
    """Upsert a batch of client-recorded sets by idempotency key.

    Returns (acked_keys, server_ids) where server_ids maps each acked key to
    its server-side SessionSet id, so the client can reconcile local rows and
    safely discard only the keys that were actually acked.

    Raises SessionNotActiveError when a batch would add a new set to a completed or
    abandoned session, so finalized history stays immutable. Replaying keys that were
    already stored is still acked, because the outcome the client wants already holds.
    """
    workout_statement = select(WorkoutSession).where(
        WorkoutSession.id == session_id,
        WorkoutSession.home_id == home_id,
        WorkoutSession.user_id == user_id,
    )
    workout_result = await session.exec(workout_statement)
    workout_session = workout_result.first()
    if not workout_session:
        raise SessionValidationError("Session not found or not accessible to this caller.")

    # Query fresh rather than trusting workout_session.exercises: with
    # expire_on_commit=False, an already-loaded relationship collection on a
    # long-lived session isn't automatically refreshed by writes elsewhere in
    # the same session (e.g. a session_exercise added directly via
    # session.add() rather than through workout_session.exercises.append()).
    valid_ids_result = await session.exec(
        select(SessionExercise.id).where(SessionExercise.session_id == workout_session.id)
    )
    valid_session_exercise_ids = set(valid_ids_result.all())

    acked: list[str] = []
    server_ids: dict[str, uuid.UUID] = {}

    for item in items:
        if item.session_exercise_id not in valid_session_exercise_ids:
            # Skip items for an exercise not on this session rather than failing
            # the whole batch — the client may be replaying stale/mixed data.
            continue

        existing_statement = select(SessionSet).where(
            SessionSet.session_exercise_id == item.session_exercise_id,
            SessionSet.client_idempotency_key == item.client_idempotency_key,
        )
        existing_result = await session.exec(existing_statement)
        existing = existing_result.first()

        if existing:
            acked.append(item.client_idempotency_key)
            server_ids[item.client_idempotency_key] = existing.id
            continue

        if workout_session.status != SessionStatus.ACTIVE:
            raise SessionNotActiveError(
                f"Session is {SessionStatus(workout_session.status).value}; sets can only be logged on an active session."
            )

        completed_at = item.completed_at or datetime.now(UTC)
        new_set = await _find_open_placeholder(session, item.session_exercise_id, item.set_order)
        if new_set is None:
            new_set = SessionSet(session_exercise_id=item.session_exercise_id, set_order=item.set_order)
        new_set.actual_reps = item.actual_reps
        new_set.actual_weight_kg = item.actual_weight_kg
        new_set.is_warmup = item.is_warmup
        new_set.completed_at = completed_at
        new_set.client_idempotency_key = item.client_idempotency_key
        session.add(new_set)
        try:
            await session.commit()
        except IntegrityError:
            # A concurrent request already inserted this key: re-fetch and ack it
            # rather than erroring, since the outcome (the set exists) is identical.
            await session.rollback()
            retry_result = await session.exec(existing_statement)
            existing = retry_result.first()
            if not existing:
                raise
            acked.append(item.client_idempotency_key)
            server_ids[item.client_idempotency_key] = existing.id
            continue

        await session.refresh(new_set)
        acked.append(item.client_idempotency_key)
        server_ids[item.client_idempotency_key] = new_set.id

    return acked, server_ids
