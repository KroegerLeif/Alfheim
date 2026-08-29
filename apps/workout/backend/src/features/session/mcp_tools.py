import uuid

from src.core.database import async_session_factory
from src.features.session import service
from src.mcp.server import mcp


@mcp.tool()
async def start_session(
    household_id: str,
    user_id: str,
    plan_id: str | None = None,
    plan_day_id: str | None = None,
) -> str:
    """Start a new workout session, optionally cloned from a plan day's current state.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - plan_id: Optional UUID string of the plan to start from.
    - plan_day_id: Optional UUID string of the plan day to clone (required together with plan_id).
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        plan_uuid = uuid.UUID(plan_id) if plan_id else None
        day_uuid = uuid.UUID(plan_day_id) if plan_day_id else None
        async with async_session_factory() as session:
            workout_session = await service.start_session(session, home_uuid, user_uuid, plan_uuid, day_uuid)
            return (
                f"Success: Started session {workout_session.id} ({len(workout_session.exercises)} exercise(s) cloned)."
            )
    except ValueError as e:
        return f"Error: Failed to start session: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def finish_session(household_id: str, user_id: str, session_id: str) -> str:
    """Mark an active workout session as completed.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - session_id: UUID string of the session to complete.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        session_uuid = uuid.UUID(session_id)
        async with async_session_factory() as session:
            workout_session = await service.complete_session(session, session_uuid, home_uuid, user_uuid)
            if not workout_session:
                return f"Session with ID {session_id} not found or not authorized."
            return f"Success: Completed session {workout_session.id}."
    except ValueError as e:
        return f"Error: Failed to complete session: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def log_completed_set(
    household_id: str,
    user_id: str,
    session_id: str,
    session_exercise_id: str,
    set_order: int,
    idempotency_key: str,
    actual_reps: int | None = None,
    actual_weight_kg: float | None = None,
) -> str:
    """Log a single completed set on an active session (safe to retry with the same idempotency_key).

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - session_id: UUID string of the session.
    - session_exercise_id: UUID string of the exercise slot within the session.
    - set_order: Position of this set within the exercise.
    - idempotency_key: Client-generated unique key for this set (re-sending the same key is a no-op).
    - actual_reps: Reps actually performed.
    - actual_weight_kg: Weight actually used, in kg.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        session_uuid = uuid.UUID(session_id)
        exercise_uuid = uuid.UUID(session_exercise_id)
        from src.features.session.schemas import SessionSetSyncItem

        item = SessionSetSyncItem(
            client_idempotency_key=idempotency_key,
            session_exercise_id=exercise_uuid,
            set_order=set_order,
            actual_reps=actual_reps,
            actual_weight_kg=actual_weight_kg,
        )
        async with async_session_factory() as session:
            acked, server_ids = await service.sync_sets(session, session_uuid, home_uuid, user_uuid, [item])
            if not acked:
                return "Error: Set could not be logged (session or exercise not recognized)."
            return f"Success: Logged set with server ID {server_ids[idempotency_key]}."
    except ValueError as e:
        return f"Error: Failed to log set: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
