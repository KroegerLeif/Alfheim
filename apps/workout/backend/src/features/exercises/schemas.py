import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel
from src.features.exercises.models import ExerciseScope, MuscleGroup


class ExerciseCreate(SQLModel):
    """Request schema for creating a new exercise entry.

    scope/home_id/owner_user_id are never accepted from the client — they are
    derived server-side from the authenticated household/user context and an
    explicit `scope` body choice validated by the service layer.
    """

    name: str = Field(min_length=1, max_length=150)
    primary_muscle: MuscleGroup
    secondary_muscles: list[MuscleGroup] | None = Field(default=None)
    equipment_id: uuid.UUID | None = Field(default=None)
    default_unit: str = Field(default="kg", max_length=10)
    instructions: str | None = Field(default=None, max_length=2000)
    scope: ExerciseScope = Field(default=ExerciseScope.HOUSEHOLD)


class ExerciseUpdate(SQLModel):
    """Request schema for partially updating an exercise entry (PATCH)."""

    name: str | None = Field(default=None, min_length=1, max_length=150)
    primary_muscle: MuscleGroup | None = Field(default=None)
    secondary_muscles: list[MuscleGroup] | None = Field(default=None)
    equipment_id: uuid.UUID | None = Field(default=None)
    default_unit: str | None = Field(default=None, max_length=10)
    instructions: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = Field(default=None)


class ExerciseRead(SQLModel):
    """Response schema for an exercise entry."""

    id: uuid.UUID
    scope: ExerciseScope
    home_id: uuid.UUID | None
    owner_user_id: uuid.UUID | None
    name: str
    primary_muscle: MuscleGroup
    secondary_muscles: list[MuscleGroup] | None
    equipment_id: uuid.UUID | None
    default_unit: str
    instructions: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserExercisePreferenceUpsert(SQLModel):
    """Request schema for creating/updating a user's exercise preference (PUT-style upsert)."""

    default_target_weight_kg: float | None = Field(default=None)
    preferred_unit: str | None = Field(default=None, max_length=10)
    notes: str | None = Field(default=None, max_length=500)


class UserExercisePreferenceRead(SQLModel):
    """Response schema for a user's exercise preference."""

    id: uuid.UUID
    exercise_id: uuid.UUID
    default_target_weight_kg: float | None
    preferred_unit: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ExerciseFavoriteRead(SQLModel):
    """Response schema for an exercise favorite."""

    id: uuid.UUID
    exercise_id: uuid.UUID
    created_at: datetime
