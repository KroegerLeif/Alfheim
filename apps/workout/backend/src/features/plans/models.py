import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, String
from sqlmodel import Field, Relationship, SQLModel, func


class TargetWeightType(str, enum.Enum):
    """How a plan set's target weight should be resolved at session-start."""

    ABSOLUTE = "absolute"
    DEFAULT = "default"
    OFFSET = "offset"


class Plan(SQLModel, table=True):
    """A multi-day workout split routine, owned by a user within a household."""

    __tablename__ = "plans"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    home_id: uuid.UUID = Field(nullable=False, index=True)
    owner_user_id: uuid.UUID = Field(nullable=False, index=True)
    name: str = Field(min_length=1, max_length=150, nullable=False)
    description: str | None = Field(default=None, max_length=1000)
    is_shared: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="If True, visible to the whole household. If False, owner-only.",
    )
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
    )

    days: list["PlanDay"] = Relationship(
        sa_relationship_kwargs={"lazy": "selectin", "order_by": "PlanDay.day_order", "cascade": "all, delete-orphan"}
    )


class PlanDay(SQLModel, table=True):
    """A single day within a plan's split (e.g. 'Push', 'Pull', 'Legs')."""

    __tablename__ = "plan_days"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    # Optional at the Python level (default=None) because a nested create builds
    # this object before its parent Plan has been flushed; the FK is populated
    # either by the `days` relationship's cascade or explicitly post-construction
    # (see plan_crud_service.py) — always non-null by the time it's persisted.
    plan_id: uuid.UUID | None = Field(default=None, foreign_key="plans.id", index=True)
    day_order: int = Field(nullable=False, description="0-based position of this day within the split.")
    label: str = Field(min_length=1, max_length=100, nullable=False)

    exercises: list["PlanExercise"] = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "order_by": "PlanExercise.exercise_order",
            "cascade": "all, delete-orphan",
        }
    )


class PlanExercise(SQLModel, table=True):
    """A single exercise slot within a plan day."""

    __tablename__ = "plan_exercises"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    # See PlanDay.plan_id docstring for why this is Optional at the Python level.
    plan_day_id: uuid.UUID | None = Field(default=None, foreign_key="plan_days.id", index=True)
    exercise_id: uuid.UUID = Field(foreign_key="exercises.id", nullable=False, index=True)
    exercise_order: int = Field(nullable=False)

    sets: list["PlanSet"] = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "order_by": "PlanSet.set_order",
            "cascade": "all, delete-orphan",
        }
    )


class PlanSet(SQLModel, table=True):
    """A single planned set, carrying the relative weight engine fields.

    Exactly one of (target_weight_kg, offset_kg) is meaningful, selected by
    target_weight_type: ABSOLUTE uses target_weight_kg as-is, DEFAULT uses the
    caller's UserExercisePreference baseline, OFFSET adds offset_kg to that
    baseline. See plans/services/weight_engine_service.py::resolve_target_weight.
    """

    __tablename__ = "plan_sets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    # See PlanDay.plan_id docstring for why this is Optional at the Python level.
    plan_exercise_id: uuid.UUID | None = Field(default=None, foreign_key="plan_exercises.id", index=True)
    set_order: int = Field(nullable=False)
    target_reps: int | None = Field(default=None)
    target_weight_type: TargetWeightType = Field(
        sa_column=Column(String, nullable=False),
        default=TargetWeightType.DEFAULT,
    )
    target_weight_kg: float | None = Field(
        default=None, description="Meaningful only when target_weight_type=absolute."
    )
    offset_kg: float | None = Field(default=None, description="Meaningful only when target_weight_type=offset.")
    is_warmup: bool = Field(default=False, nullable=False)
