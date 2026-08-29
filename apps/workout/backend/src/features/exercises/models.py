import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Column, DateTime, Index, String
from sqlmodel import Field, SQLModel, func


class MuscleGroup(str, enum.Enum):
    """Primary/secondary muscle group targeted by an exercise."""

    CHEST = "chest"
    BACK = "back"
    SHOULDERS = "shoulders"
    BICEPS = "biceps"
    TRICEPS = "triceps"
    QUADS = "quads"
    HAMSTRINGS = "hamstrings"
    GLUTES = "glutes"
    CALVES = "calves"
    CORE = "core"
    FOREARMS = "forearms"
    TRAPS = "traps"
    FULL_BODY = "full_body"


class ExerciseScope(str, enum.Enum):
    """Visibility scope of an exercise entry."""

    SYSTEM = "system"
    HOUSEHOLD = "household"
    USER = "user"


class Exercise(SQLModel, table=True):
    """Exercise catalog entry, visible per its scope.

    A row is visible when scope=system (to everyone), scope=household and
    home_id matches the caller's household, or scope=user and owner_user_id
    matches the caller's user id.
    """

    __tablename__ = "exercises"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for this exercise entry.",
    )
    scope: ExerciseScope = Field(
        sa_column=Column(String, nullable=False, index=True),
        description="Visibility scope of this exercise entry.",
    )
    home_id: uuid.UUID | None = Field(
        default=None,
        index=True,
        description="Household this entry belongs to. Set only when scope=household.",
    )
    owner_user_id: uuid.UUID | None = Field(
        default=None,
        index=True,
        description="User this entry belongs to. Set only when scope=user.",
    )
    name: str = Field(
        min_length=1,
        max_length=150,
        nullable=False,
        description="Name of the exercise (e.g. 'Barbell Bench Press').",
    )
    primary_muscle: MuscleGroup = Field(
        sa_column=Column(String, nullable=False, index=True),
        description="Primary muscle group targeted by this exercise.",
    )
    secondary_muscles: list[MuscleGroup] | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="Optional secondary muscle groups also engaged.",
    )
    equipment_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="equipment.id",
        index=True,
        description="Optional equipment entry required to perform this exercise.",
    )
    default_unit: str = Field(default="kg", max_length=10, description="Default weight unit for this exercise.")
    instructions: str | None = Field(default=None, max_length=2000, description="Optional free-text instructions.")
    is_active: bool = Field(default=True, nullable=False, description="Whether this entry is currently usable.")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
        description="Timestamp of creation, stored in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        description="Timestamp of last update, stored in UTC.",
    )


class UserExercisePreference(SQLModel, table=True):
    """Per-user preferences for a given exercise (target weight, unit, notes)."""

    __tablename__ = "user_exercise_preferences"
    __table_args__ = (Index("uq_user_exercise_pref", "user_id", "exercise_id", unique=True),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    home_id: uuid.UUID = Field(nullable=False, index=True)
    user_id: uuid.UUID = Field(nullable=False, index=True)
    exercise_id: uuid.UUID = Field(foreign_key="exercises.id", nullable=False, index=True)
    default_target_weight_kg: float | None = Field(default=None)
    preferred_unit: str | None = Field(default=None, max_length=10)
    notes: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
    )


class ExerciseFavorite(SQLModel, table=True):
    """Marks an exercise as favorited by a given user."""

    __tablename__ = "exercise_favorites"
    __table_args__ = (Index("uq_user_exercise_favorite", "user_id", "exercise_id", unique=True),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    home_id: uuid.UUID = Field(nullable=False, index=True)
    user_id: uuid.UUID = Field(nullable=False, index=True)
    exercise_id: uuid.UUID = Field(foreign_key="exercises.id", nullable=False, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
