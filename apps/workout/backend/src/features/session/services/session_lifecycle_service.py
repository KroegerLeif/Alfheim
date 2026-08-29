"""Session lifecycle: start (clone-from-plan), complete, abandon.

The clone-at-start procedure is the app's core "template vs. log" invariant:
a WorkoutSession's SessionExercise/SessionSet rows are structural copies of
the source PlanDay's state at the moment the session starts, never live FKs
into PlanExercise/PlanSet. Editing or deleting the Plan afterward must never
alter a past session's data. See models.py docstrings for the exact fields
each clone copies.
"""

import uuid
from datetime import UTC, datetime

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.models import Exercise, UserExercisePreference
from src.features.plans.models import Plan, PlanDay
from src.features.plans.services.weight_engine_service import resolve_target_weight
from src.features.session.exceptions import SessionValidationError
from src.features.session.models import SessionExercise, SessionSet, SessionStatus, WorkoutSession


def _muscle_value(primary_muscle) -> str:
    """Normalize an Exercise.primary_muscle read to its plain string value.

    The column is declared sa_column=Column(String) for dual-dialect safety,
    so SQLAlchemy returns a plain str on a fresh load from the DB — but an
    in-memory object that was just constructed (not yet round-tripped through
    the DB) still holds the MuscleGroup enum instance. Handle both.
    """
    return primary_muscle.value if hasattr(primary_muscle, "value") else str(primary_muscle)


async def start_session(
    session: AsyncSession,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
    plan_id: uuid.UUID | None = None,
    plan_day_id: uuid.UUID | None = None,
) -> WorkoutSession:
    """Start a new workout session, optionally cloned from a plan day's state.

    If plan_id/plan_day_id are omitted, an empty freeform session is started
    (exercises/sets can still be logged ad hoc via the sync endpoint, without a
    plan backing them).
    """
    if (plan_id is None) != (plan_day_id is None):
        raise SessionValidationError("plan_id and plan_day_id must be provided together.")

    workout_session = WorkoutSession(home_id=home_id, user_id=user_id, status=SessionStatus.ACTIVE)

    if plan_id is not None:
        plan_statement = select(Plan).where(
            Plan.id == plan_id,
            Plan.home_id == home_id,
        )
        plan_result = await session.exec(plan_statement)
        plan = plan_result.first()
        if not plan or (plan.owner_user_id != user_id and not plan.is_shared):
            raise SessionValidationError("Plan not found or not accessible to this caller.")

        # Query the day directly rather than trusting plan.days: with
        # expire_on_commit=False, a Plan already loaded earlier in this
        # session can carry a stale relationship collection.
        day_result = await session.exec(select(PlanDay).where(PlanDay.id == plan_day_id, PlanDay.plan_id == plan.id))
        day = day_result.first()
        if not day:
            raise SessionValidationError("Plan day not found on the specified plan.")

        workout_session.plan_id = plan.id
        workout_session.plan_day_label = day.label

        exercise_ids = {pe.exercise_id for pe in day.exercises}
        exercises_by_id: dict[uuid.UUID, Exercise] = {}
        preferences_by_exercise: dict[uuid.UUID, UserExercisePreference] = {}
        if exercise_ids:
            ex_result = await session.exec(select(Exercise).where(col(Exercise.id).in_(exercise_ids)))
            exercises_by_id = {e.id: e for e in ex_result.all()}

            pref_result = await session.exec(
                select(UserExercisePreference).where(
                    UserExercisePreference.user_id == user_id,
                    col(UserExercisePreference.exercise_id).in_(exercise_ids),
                )
            )
            preferences_by_exercise = {p.exercise_id: p for p in pref_result.all()}

        cloned_exercises: list[SessionExercise] = []
        for plan_exercise in day.exercises:
            source_exercise = exercises_by_id.get(plan_exercise.exercise_id)
            if not source_exercise:
                # The exercise was deleted after the plan was built; skip it rather
                # than fail the whole session start, since past exercises must
                # never block starting today's workout.
                continue

            preference = preferences_by_exercise.get(plan_exercise.exercise_id)
            session_exercise = SessionExercise(
                exercise_id=source_exercise.id,
                exercise_name_snapshot=source_exercise.name,
                primary_muscle_snapshot=_muscle_value(source_exercise.primary_muscle),
                exercise_order=plan_exercise.exercise_order,
            )
            session_exercise.sets = [
                SessionSet(
                    set_order=plan_set.set_order,
                    target_reps=plan_set.target_reps,
                    target_weight_kg=resolve_target_weight(plan_set, preference),
                    is_warmup=plan_set.is_warmup,
                )
                for plan_set in plan_exercise.sets
            ]
            cloned_exercises.append(session_exercise)

        workout_session.exercises = cloned_exercises

    session.add(workout_session)
    await session.commit()
    session_id = workout_session.id

    # Return a freshly re-queried object rather than the just-built one:
    # whether a just-committed object's relationship attributes remain
    # correctly populated after commit/refresh is fragile to rely on (it
    # depends on exactly what was/wasn't touched pre-commit), and a
    # synchronous access on a not-fully-loaded relationship later — e.g.
    # during response serialization — fails with sqlalchemy.exc.MissingGreenlet
    # since AsyncSession can't lazy-load outside an explicit awaited call. A
    # fresh select() reliably populates every `lazy="selectin"` relationship
    # within this awaited call.
    refetched = await get_session(session, session_id, home_id, user_id)
    if refetched is None:
        raise SessionValidationError("Session was created but could not be re-fetched.")
    return refetched


async def get_session(
    session: AsyncSession,
    session_id: uuid.UUID,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
) -> WorkoutSession | None:
    statement = select(WorkoutSession).where(
        WorkoutSession.id == session_id,
        WorkoutSession.home_id == home_id,
        WorkoutSession.user_id == user_id,
    )
    result = await session.exec(statement)
    return result.first()


async def list_sessions(
    session: AsyncSession,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
    status_filter: SessionStatus | None = None,
    limit: int = 100,
    offset: int = 0,
):
    statement = select(WorkoutSession).where(
        WorkoutSession.home_id == home_id,
        WorkoutSession.user_id == user_id,
    )
    if status_filter is not None:
        statement = statement.where(WorkoutSession.status == status_filter)
    statement = statement.order_by(col(WorkoutSession.started_at).desc()).offset(offset).limit(limit)
    result = await session.exec(statement)
    return result.all()


async def complete_session(
    session: AsyncSession,
    session_id: uuid.UUID,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
) -> WorkoutSession | None:
    workout_session = await get_session(session, session_id, home_id, user_id)
    if not workout_session:
        return None
    if workout_session.status != SessionStatus.ACTIVE:
        raise SessionValidationError("Only an active session can be completed.")
    workout_session.status = SessionStatus.COMPLETED
    workout_session.completed_at = datetime.now(UTC)
    session.add(workout_session)
    await session.commit()
    await session.refresh(workout_session)
    return workout_session


async def abandon_session(
    session: AsyncSession,
    session_id: uuid.UUID,
    home_id: uuid.UUID,
    user_id: uuid.UUID,
) -> WorkoutSession | None:
    workout_session = await get_session(session, session_id, home_id, user_id)
    if not workout_session:
        return None
    if workout_session.status != SessionStatus.ACTIVE:
        raise SessionValidationError("Only an active session can be abandoned.")
    workout_session.status = SessionStatus.ABANDONED
    workout_session.completed_at = datetime.now(UTC)
    session.add(workout_session)
    await session.commit()
    await session.refresh(workout_session)
    return workout_session
