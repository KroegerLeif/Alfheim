"""Request and response schemas of the plans feature."""

import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel
from src.features.plans.models import TargetWeightType


class PlanSetCreate(SQLModel):
    """Input for a plan set; the target weight is resolved at session start."""

    target_reps: int | None = Field(default=None, ge=1)
    target_weight_type: TargetWeightType = Field(default=TargetWeightType.DEFAULT)
    target_weight_kg: float | None = Field(default=None, ge=0)
    offset_kg: float | None = Field(default=None)
    is_warmup: bool = Field(default=False)


class PlanSetUpdate(SQLModel):
    """Partial update of a plan set; only fields that are sent are changed."""

    target_reps: int | None = Field(default=None, ge=1)
    target_weight_type: TargetWeightType | None = Field(default=None)
    target_weight_kg: float | None = Field(default=None, ge=0)
    offset_kg: float | None = Field(default=None)
    is_warmup: bool | None = Field(default=None)


class PlanSetRead(SQLModel):
    """A plan set as stored, with its unresolved target weight definition."""

    id: uuid.UUID
    set_order: int
    target_reps: int | None
    target_weight_type: TargetWeightType
    target_weight_kg: float | None
    offset_kg: float | None
    is_warmup: bool


class PlanExerciseCreate(SQLModel):
    """Input for an exercise within a plan day, with optional initial sets."""

    exercise_id: uuid.UUID
    sets: list[PlanSetCreate] = Field(default_factory=list)


class PlanExerciseRead(SQLModel):
    """A plan exercise with its ordered sets."""

    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_order: int
    sets: list[PlanSetRead]


class PlanDayCreate(SQLModel):
    """Input for a plan day, with optional nested exercises."""

    label: str = Field(min_length=1, max_length=100)
    exercises: list[PlanExerciseCreate] = Field(default_factory=list)


class PlanDayRead(SQLModel):
    """A plan day with its ordered exercises."""

    id: uuid.UUID
    day_order: int
    label: str
    exercises: list[PlanExerciseRead]


class PlanCreate(SQLModel):
    """Input for a plan, with optional nested days."""

    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    is_shared: bool = Field(default=False)
    days: list[PlanDayCreate] = Field(default_factory=list)


class PlanUpdate(SQLModel):
    """Update a plan's metadata and optionally replace its full nested days structure."""

    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    is_shared: bool | None = Field(default=None)
    is_active: bool | None = Field(default=None)
    days: list[PlanDayCreate] | None = Field(default=None)


class PlanRead(SQLModel):
    """A plan with its full nested days structure."""

    id: uuid.UUID
    home_id: uuid.UUID
    owner_user_id: uuid.UUID
    name: str
    description: str | None
    is_shared: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    days: list[PlanDayRead]


class ResolvedSetRead(SQLModel):
    """A plan set with its weight-engine target resolved to a concrete kg value."""

    id: uuid.UUID
    set_order: int
    target_reps: int | None
    target_weight_type: TargetWeightType
    resolved_weight_kg: float | None
    is_warmup: bool


class ResolvedExerciseRead(SQLModel):
    """A plan exercise whose sets carry resolved weights."""

    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_order: int
    sets: list[ResolvedSetRead]


class ResolvedDayRead(SQLModel):
    """A plan day whose exercises carry resolved weights."""

    id: uuid.UUID
    day_order: int
    label: str
    exercises: list[ResolvedExerciseRead]
