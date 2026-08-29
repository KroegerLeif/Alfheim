import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import and_, col, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.exceptions import ExerciseValidationError
from src.features.exercises.models import Exercise, ExerciseFavorite, ExerciseScope, MuscleGroup, UserExercisePreference
from src.features.exercises.schemas import ExerciseCreate, ExerciseUpdate, UserExercisePreferenceUpsert


def _visibility_filter(home_id: uuid.UUID, user_id: uuid.UUID):
    """Build the scope-union visibility predicate: system OR own-household OR own-user rows."""
    return or_(
        Exercise.scope == ExerciseScope.SYSTEM,
        and_(Exercise.scope == ExerciseScope.HOUSEHOLD, Exercise.home_id == home_id),
        and_(Exercise.scope == ExerciseScope.USER, Exercise.owner_user_id == user_id),
    )


def _writable_filter(home_id: uuid.UUID, user_id: uuid.UUID):
    """Build the writable-ownership predicate: system rows are never writable via the API."""
    return or_(
        and_(Exercise.scope == ExerciseScope.HOUSEHOLD, Exercise.home_id == home_id),
        and_(Exercise.scope == ExerciseScope.USER, Exercise.owner_user_id == user_id),
    )


class ExerciseService:
    """Service class encapsulating async database operations for Exercise and related entities."""

    @staticmethod
    async def create_exercise(
        session: AsyncSession,
        payload: ExerciseCreate,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Exercise:
        """Create a new household- or user-scoped exercise entry.

        System-scoped exercises cannot be created through the API; they are
        only seeded at application startup.
        """
        if payload.scope == ExerciseScope.SYSTEM:
            raise ExerciseValidationError("System-scoped exercises cannot be created via the API.")

        exercise = Exercise(
            scope=payload.scope,
            name=payload.name,
            primary_muscle=payload.primary_muscle,
            secondary_muscles=payload.secondary_muscles,
            equipment_id=payload.equipment_id,
            default_unit=payload.default_unit,
            instructions=payload.instructions,
            home_id=home_id if payload.scope == ExerciseScope.HOUSEHOLD else None,
            owner_user_id=user_id if payload.scope == ExerciseScope.USER else None,
        )
        session.add(exercise)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ExerciseValidationError(f"Failed to create exercise: {e}") from e
        await session.refresh(exercise)
        return exercise

    @staticmethod
    async def list_exercises(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        primary_muscle: MuscleGroup | None = None,
        is_active: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Exercise]:
        """Retrieve all exercises visible to the caller: system + own household + own user entries."""
        statement = select(Exercise).where(_visibility_filter(home_id, user_id))

        if primary_muscle is not None:
            statement = statement.where(Exercise.primary_muscle == primary_muscle)
        if is_active is not None:
            statement = statement.where(Exercise.is_active == is_active)

        statement = statement.order_by(Exercise.name).offset(offset).limit(limit)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def get_exercise(
        session: AsyncSession,
        exercise_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Exercise | None:
        """Retrieve a single exercise entry, scoped to what the caller may see."""
        statement = select(Exercise).where(
            Exercise.id == exercise_id,
            _visibility_filter(home_id, user_id),
        )
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def update_exercise(
        session: AsyncSession,
        exercise_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: ExerciseUpdate,
    ) -> Exercise | None:
        """Partially update an exercise entry the caller owns. System entries are never writable."""
        exercise = await ExerciseService._get_writable(session, exercise_id, home_id, user_id)
        if not exercise:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(exercise, key, value)

        session.add(exercise)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ExerciseValidationError(f"Failed to update exercise: {e}") from e
        await session.refresh(exercise)
        return exercise

    @staticmethod
    async def delete_exercise(
        session: AsyncSession,
        exercise_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """Delete an exercise entry the caller owns. System entries are never writable."""
        exercise = await ExerciseService._get_writable(session, exercise_id, home_id, user_id)
        if not exercise:
            return False

        await session.delete(exercise)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ExerciseValidationError(f"Failed to delete exercise: {e}") from e
        return True

    @staticmethod
    async def _get_writable(
        session: AsyncSession,
        exercise_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Exercise | None:
        statement = select(Exercise).where(
            Exercise.id == exercise_id,
            _writable_filter(home_id, user_id),
        )
        result = await session.exec(statement)
        return result.first()

    # -- Preferences ---------------------------------------------------

    @staticmethod
    async def upsert_preference(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        exercise_id: uuid.UUID,
        payload: UserExercisePreferenceUpsert,
    ) -> UserExercisePreference:
        """Get-or-create a user's preference row for an exercise, keyed on (user_id, exercise_id).

        Verifies the exercise is visible to the caller before allowing the upsert.
        """
        exercise = await ExerciseService.get_exercise(session, exercise_id, home_id, user_id)
        if not exercise:
            raise ExerciseValidationError("Exercise not found or not visible to caller.")

        preference = await ExerciseService.get_preference(session, home_id, user_id, exercise_id)
        update_data = payload.model_dump(exclude_unset=True)

        if preference:
            for key, value in update_data.items():
                setattr(preference, key, value)
        else:
            preference = UserExercisePreference(
                home_id=home_id,
                user_id=user_id,
                exercise_id=exercise_id,
                **update_data,
            )

        session.add(preference)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ExerciseValidationError(f"Failed to save preference: {e}") from e
        await session.refresh(preference)
        return preference

    @staticmethod
    async def get_preference(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        exercise_id: uuid.UUID,
    ) -> UserExercisePreference | None:
        """Retrieve the caller's preference row for a given exercise, if any."""
        statement = select(UserExercisePreference).where(
            UserExercisePreference.user_id == user_id,
            UserExercisePreference.exercise_id == exercise_id,
            UserExercisePreference.home_id == home_id,
        )
        result = await session.exec(statement)
        return result.first()

    # -- Favorites -------------------------------------------------------

    @staticmethod
    async def add_favorite(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        exercise_id: uuid.UUID,
    ) -> ExerciseFavorite:
        """Favorite an exercise for the caller. Idempotent: re-adding returns the existing row.

        Checks for an existing row first (the common re-favorite case), and falls back to
        catching IntegrityError from a concurrent insert as a safety net.
        """
        existing_statement = select(ExerciseFavorite).where(
            ExerciseFavorite.user_id == user_id,
            ExerciseFavorite.exercise_id == exercise_id,
        )
        result = await session.exec(existing_statement)
        existing = result.first()
        if existing:
            return existing

        favorite = ExerciseFavorite(home_id=home_id, user_id=user_id, exercise_id=exercise_id)
        session.add(favorite)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            result = await session.exec(existing_statement)
            existing = result.first()
            if existing:
                return existing
            raise
        await session.refresh(favorite)
        return favorite

    @staticmethod
    async def remove_favorite(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
        exercise_id: uuid.UUID,
    ) -> bool:
        """Unfavorite an exercise for the caller. Returns whether a row was deleted."""
        statement = select(ExerciseFavorite).where(
            ExerciseFavorite.user_id == user_id,
            ExerciseFavorite.exercise_id == exercise_id,
        )
        result = await session.exec(statement)
        favorite = result.first()
        if not favorite:
            return False

        await session.delete(favorite)
        await session.commit()
        return True

    @staticmethod
    async def list_favorites(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Sequence[ExerciseFavorite]:
        """List the caller's favorite rows."""
        statement = select(ExerciseFavorite).where(ExerciseFavorite.user_id == user_id)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def list_favorite_exercises(
        session: AsyncSession,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Sequence[Exercise]:
        """List the actual Exercise rows the caller has favorited."""
        statement = (
            select(Exercise)
            .join(ExerciseFavorite, col(ExerciseFavorite.exercise_id) == Exercise.id)
            .where(ExerciseFavorite.user_id == user_id)
            .order_by(Exercise.name)
        )
        result = await session.exec(statement)
        return result.all()
