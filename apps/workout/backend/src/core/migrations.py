"""Model registry and migration lock key of the Workout service (runner: ``backend_shared.db``)."""

MIGRATION_LOCK_KEY = 7_265_003  # pg_advisory_xact_lock key, scoped per database; never change it


def load_models() -> None:
    """Import every model module so all tables are registered on ``SQLModel.metadata``."""
    from src.features.equipment.models import Equipment  # noqa: F401
    from src.features.exercises.models import Exercise, ExerciseFavorite, UserExercisePreference  # noqa: F401
    from src.features.plans.models import Plan, PlanDay, PlanExercise, PlanSet  # noqa: F401
    from src.features.session.models import SessionExercise, SessionSet, WorkoutSession  # noqa: F401
