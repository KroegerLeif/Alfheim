"""Offline-sync ack logic: upsert-by-idempotency-key so a client can safely
re-POST the same batch of locally-recorded sets after a flaky retry, and so a
set logged offline reconciles to a single server row instead of duplicating.
"""

import uuid

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.session.exceptions import SessionValidationError
from src.features.session.models import SessionExercise, SessionSet, WorkoutSession
from src.features.session.schemas import SessionSetSyncItem


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

        new_set = SessionSet(
            session_exercise_id=item.session_exercise_id,
            set_order=item.set_order,
            actual_reps=item.actual_reps,
            actual_weight_kg=item.actual_weight_kg,
            is_warmup=item.is_warmup,
            completed_at=item.completed_at,
            client_idempotency_key=item.client_idempotency_key,
        )
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
