import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.core.dependencies import UserHomeContext, get_current_user_and_home
from src.features.exercises.models import MuscleGroup
from src.features.exercises.schemas import (
    ExerciseCreate,
    ExerciseFavoriteRead,
    ExerciseRead,
    ExerciseUpdate,
    UserExercisePreferenceRead,
    UserExercisePreferenceUpsert,
)
from src.features.exercises.service import ExerciseService

router = APIRouter(prefix="/api/v1/exercises", tags=["exercises"])


@router.post("", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    payload: ExerciseCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new household- or user-scoped exercise entry."""
    return await ExerciseService.create_exercise(
        session=session,
        payload=payload,
        home_id=context.home_id,
        user_id=context.user_id,
    )


@router.get("", response_model=list[ExerciseRead])
async def list_exercises(
    primary_muscle: MuscleGroup | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List all exercises visible to the caller: system + own household + own user entries."""
    return await ExerciseService.list_exercises(
        session=session,
        home_id=context.home_id,
        user_id=context.user_id,
        primary_muscle=primary_muscle,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


@router.get("/favorites", response_model=list[ExerciseRead])
async def list_favorite_exercises(
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List the exercises the caller has favorited.

    Registered before GET /{id} so this literal path is not swallowed by the
    {id} path parameter.
    """
    return await ExerciseService.list_favorite_exercises(
        session=session,
        home_id=context.home_id,
        user_id=context.user_id,
    )


@router.get("/{id}", response_model=ExerciseRead)
async def get_exercise(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve details for a specific exercise entry by ID."""
    exercise = await ExerciseService.get_exercise(
        session=session,
        exercise_id=id,
        home_id=context.home_id,
        user_id=context.user_id,
    )
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found.")
    return exercise


@router.patch("/{id}", response_model=ExerciseRead)
async def update_exercise(
    id: uuid.UUID,
    payload: ExerciseUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Partially update an exercise entry the caller owns. System entries cannot be modified."""
    exercise = await ExerciseService.update_exercise(
        session=session,
        exercise_id=id,
        home_id=context.home_id,
        user_id=context.user_id,
        payload=payload,
    )
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found.")
    return exercise


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete an exercise entry the caller owns. System entries cannot be deleted."""
    deleted = await ExerciseService.delete_exercise(
        session=session,
        exercise_id=id,
        home_id=context.home_id,
        user_id=context.user_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found.")


@router.put("/{id}/preference", response_model=UserExercisePreferenceRead)
async def upsert_exercise_preference(
    id: uuid.UUID,
    payload: UserExercisePreferenceUpsert,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create or update the caller's preference for an exercise."""
    return await ExerciseService.upsert_preference(
        session=session,
        home_id=context.home_id,
        user_id=context.user_id,
        exercise_id=id,
        payload=payload,
    )


@router.get("/{id}/preference", response_model=UserExercisePreferenceRead)
async def get_exercise_preference(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve the caller's preference for an exercise."""
    preference = await ExerciseService.get_preference(
        session=session,
        home_id=context.home_id,
        user_id=context.user_id,
        exercise_id=id,
    )
    if not preference:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preference not found.")
    return preference


@router.post("/{id}/favorite", response_model=ExerciseFavoriteRead, status_code=status.HTTP_201_CREATED)
async def favorite_exercise(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Favorite an exercise for the caller. Idempotent."""
    return await ExerciseService.add_favorite(
        session=session,
        home_id=context.home_id,
        user_id=context.user_id,
        exercise_id=id,
    )


@router.delete("/{id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def unfavorite_exercise(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Remove a favorite for the caller."""
    deleted = await ExerciseService.remove_favorite(
        session=session,
        home_id=context.home_id,
        user_id=context.user_id,
        exercise_id=id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found.")
