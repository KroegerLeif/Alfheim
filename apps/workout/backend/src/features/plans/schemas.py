import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel
from src.features.plans.models import TargetWeightType


class PlanSetCreate(SQLModel):
    target_reps: int | None = Field(default=None, ge=1)
    target_weight_type: TargetWeightType = Field(default=TargetWeightType.DEFAULT)
    target_weight_kg: float | None = Field(default=None, ge=0)
    offset_kg: float | None = Field(default=None)
    is_warmup: bool = Field(default=False)


class PlanSetUpdate(SQLModel):
    target_reps: int | None = Field(default=None, ge=1)
    target_weight_type: TargetWeightType | None = Field(default=None)
    target_weight_kg: float | None = Field(default=None, ge=0)
    offset_kg: float | None = Field(default=None)
    is_warmup: bool | None = Field(default=None)


class PlanSetRead(SQLModel):
    id: uuid.UUID
    set_order: int
    target_reps: int | None
    target_weight_type: TargetWeightType
    target_weight_kg: float | None
    offset_kg: float | None
    is_warmup: bool


class PlanExerciseCreate(SQLModel):
    exercise_id: uuid.UUID
    sets: list[PlanSetCreate] = Field(default_factory=list)


class PlanExerciseRead(SQLModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_order: int
    sets: list[PlanSetRead]


class PlanDayCreate(SQLModel):
    label: str = Field(min_length=1, max_length=100)
    exercises: list[PlanExerciseCreate] = Field(default_factory=list)


class PlanDayRead(SQLModel):
    id: uuid.UUID
    day_order: int
    label: str
    exercises: list[PlanExerciseRead]


class PlanCreate(SQLModel):
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
    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_order: int
    sets: list[ResolvedSetRead]


class ResolvedDayRead(SQLModel):
    id: uuid.UUID
    day_order: int
    label: str
    exercises: list[ResolvedExerciseRead]
