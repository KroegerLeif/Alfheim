import uuid

from src.core.database import async_session_factory
from src.features.exercises.models import ExerciseScope, MuscleGroup
from src.features.exercises.schemas import ExerciseCreate, ExerciseUpdate, UserExercisePreferenceUpsert
from src.features.exercises.service import ExerciseService
from src.mcp.server import mcp


@mcp.tool()
async def list_exercises(
    household_id: str,
    user_id: str,
    primary_muscle: str | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> str:
    """List exercises visible to the caller: system + their household's + their own entries.

    Parameters:
    - household_id: UUID string of the caller's household. Required for tenant isolation.
    - user_id: UUID string of the caller.
    - primary_muscle: Optional muscle group filter (e.g. 'chest', 'back').
    - is_active: Optional filter for active/inactive exercises.
    - limit: Maximum number of entries to return (default 100).
    - offset: Number of records to skip (default 0).
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        muscle = MuscleGroup(primary_muscle) if primary_muscle else None
        async with async_session_factory() as session:
            items = await ExerciseService.list_exercises(
                session=session,
                home_id=home_uuid,
                user_id=user_uuid,
                primary_muscle=muscle,
                is_active=is_active,
                limit=limit,
                offset=offset,
            )
            if not items:
                return "No exercises found."
            lines = [
                f"- {item.name} (ID: {item.id}, scope: {item.scope.value}, primary: {item.primary_muscle.value})"
                for item in items
            ]
            return "\n".join(lines)
    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to list exercises: {str(e)}"


@mcp.tool()
async def create_exercise(
    household_id: str,
    user_id: str,
    name: str,
    primary_muscle: str,
    secondary_muscles: list[str] | None = None,
    equipment_id: str | None = None,
    default_unit: str = "kg",
    instructions: str | None = None,
    scope: str = "household",
) -> str:
    """Create a new exercise entry scoped to the caller's household or the caller alone.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - name: Name of the exercise.
    - primary_muscle: Primary muscle group (e.g. 'chest', 'back').
    - secondary_muscles: Optional list of secondary muscle groups.
    - equipment_id: Optional UUID string of the equipment required.
    - default_unit: Default weight unit (default 'kg').
    - instructions: Optional free-text instructions.
    - scope: 'household' (default) or 'user'. System-scoped entries cannot be created via this tool.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        payload = ExerciseCreate(
            name=name,
            primary_muscle=MuscleGroup(primary_muscle),
            secondary_muscles=[MuscleGroup(m) for m in secondary_muscles] if secondary_muscles else None,
            equipment_id=uuid.UUID(equipment_id) if equipment_id else None,
            default_unit=default_unit,
            instructions=instructions,
            scope=ExerciseScope(scope),
        )
        async with async_session_factory() as session:
            exercise = await ExerciseService.create_exercise(
                session=session,
                payload=payload,
                home_id=home_uuid,
                user_id=user_uuid,
            )
            return f"Success: Created exercise '{exercise.name}' with ID {exercise.id}."
    except ValueError as e:
        return f"Error: Failed to create exercise: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def update_exercise(
    household_id: str,
    user_id: str,
    exercise_id: str,
    name: str | None = None,
    primary_muscle: str | None = None,
    secondary_muscles: list[str] | None = None,
    equipment_id: str | None = None,
    default_unit: str | None = None,
    instructions: str | None = None,
    is_active: bool | None = None,
) -> str:
    """Update an exercise entry the caller owns. System entries cannot be modified.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - exercise_id: UUID string of the exercise entry to update.
    - name: Optional new name.
    - primary_muscle: Optional new primary muscle group.
    - secondary_muscles: Optional new list of secondary muscle groups.
    - equipment_id: Optional new equipment UUID string.
    - default_unit: Optional new default unit.
    - instructions: Optional new instructions.
    - is_active: Optional new active status.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        ex_uuid = uuid.UUID(exercise_id)
        payload = ExerciseUpdate(
            name=name,
            primary_muscle=MuscleGroup(primary_muscle) if primary_muscle else None,
            secondary_muscles=[MuscleGroup(m) for m in secondary_muscles] if secondary_muscles else None,
            equipment_id=uuid.UUID(equipment_id) if equipment_id else None,
            default_unit=default_unit,
            instructions=instructions,
            is_active=is_active,
        )
        async with async_session_factory() as session:
            exercise = await ExerciseService.update_exercise(
                session=session,
                exercise_id=ex_uuid,
                home_id=home_uuid,
                user_id=user_uuid,
                payload=payload,
            )
            if not exercise:
                return f"Exercise with ID {exercise_id} not found or not authorized."
            return f"Success: Updated exercise {exercise.id} (Name: '{exercise.name}')."
    except ValueError as e:
        return f"Error: Update failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def delete_exercise(household_id: str, user_id: str, exercise_id: str) -> str:
    """Delete an exercise entry the caller owns. System entries cannot be deleted.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - exercise_id: UUID string of the exercise entry to delete.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        ex_uuid = uuid.UUID(exercise_id)
        async with async_session_factory() as session:
            deleted = await ExerciseService.delete_exercise(
                session=session,
                exercise_id=ex_uuid,
                home_id=home_uuid,
                user_id=user_uuid,
            )
            if not deleted:
                return f"Exercise with ID {exercise_id} not found or not authorized."
            return f"Success: Deleted exercise {exercise_id}."
    except ValueError as e:
        return f"Error: Deletion failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def set_exercise_preference(
    household_id: str,
    user_id: str,
    exercise_id: str,
    default_target_weight_kg: float | None = None,
    preferred_unit: str | None = None,
    notes: str | None = None,
) -> str:
    """Create or update the caller's preference (target weight, unit, notes) for an exercise.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - exercise_id: UUID string of the exercise.
    - default_target_weight_kg: Optional default target weight in kg.
    - preferred_unit: Optional preferred weight unit.
    - notes: Optional free-text notes.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        ex_uuid = uuid.UUID(exercise_id)
        payload = UserExercisePreferenceUpsert(
            default_target_weight_kg=default_target_weight_kg,
            preferred_unit=preferred_unit,
            notes=notes,
        )
        async with async_session_factory() as session:
            preference = await ExerciseService.upsert_preference(
                session=session,
                home_id=home_uuid,
                user_id=user_uuid,
                exercise_id=ex_uuid,
                payload=payload,
            )
            return f"Success: Saved preference {preference.id} for exercise {exercise_id}."
    except ValueError as e:
        return f"Error: Failed to save preference: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def favorite_exercise(household_id: str, user_id: str, exercise_id: str) -> str:
    """Favorite an exercise for the caller. Idempotent: favoriting twice is safe.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - exercise_id: UUID string of the exercise to favorite.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        ex_uuid = uuid.UUID(exercise_id)
        async with async_session_factory() as session:
            favorite = await ExerciseService.add_favorite(
                session=session,
                home_id=home_uuid,
                user_id=user_uuid,
                exercise_id=ex_uuid,
            )
            return f"Success: Favorited exercise {exercise_id} (favorite ID: {favorite.id})."
    except ValueError as e:
        return f"Error: Failed to favorite exercise: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def unfavorite_exercise(household_id: str, user_id: str, exercise_id: str) -> str:
    """Remove a favorite for the caller.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - exercise_id: UUID string of the exercise to unfavorite.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        ex_uuid = uuid.UUID(exercise_id)
        async with async_session_factory() as session:
            deleted = await ExerciseService.remove_favorite(
                session=session,
                home_id=home_uuid,
                user_id=user_uuid,
                exercise_id=ex_uuid,
            )
            if not deleted:
                return f"No favorite found for exercise {exercise_id}."
            return f"Success: Unfavorited exercise {exercise_id}."
    except ValueError as e:
        return f"Error: Failed to unfavorite exercise: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
