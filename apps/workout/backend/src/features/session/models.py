import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, text
from sqlmodel import Field, Relationship, SQLModel, func


class SessionStatus(str, enum.Enum):
    """Lifecycle state of a workout session."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class WorkoutSession(SQLModel, table=True):
    """A live/completed workout execution log.

    plan_id is a soft "started from" reference only — it is never joined for
    display data, since the point of cloning SessionExercise/SessionSet at
    start-time is that later edits/deletes to the source Plan must not alter
    this historical record.
    """

    __tablename__ = "workout_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    home_id: uuid.UUID = Field(nullable=False, index=True)
    user_id: uuid.UUID = Field(nullable=False, index=True)
    plan_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(ForeignKey("plans.id", ondelete="SET NULL"), nullable=True, index=True),
        description="Soft 'started from' reference; set to NULL if the source plan is later deleted.",
    )
    plan_day_label: str | None = Field(default=None, max_length=100, description="Copied plan day label at start.")
    started_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    completed_at: datetime | None = Field(default=None)
    status: SessionStatus = Field(
        sa_column=Column(String, nullable=False, index=True),
        default=SessionStatus.ACTIVE,
    )
    notes: str | None = Field(default=None, max_length=1000)

    exercises: list["SessionExercise"] = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "order_by": "SessionExercise.exercise_order",
            "cascade": "all, delete-orphan",
        }
    )


class SessionExercise(SQLModel, table=True):
    """A structural clone of a PlanExercise, snapshotted at session-start.

    exercise_id is kept live (not cloned) so analytics can still resolve
    exercise identity; name/muscle are snapshotted so a later exercise rename
    or deletion never rewrites how a past session displays.
    """

    __tablename__ = "session_exercises"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    # Optional at the Python level (default=None): built before being assigned
    # to WorkoutSession.exercises, which populates the FK via the relationship
    # cascade — always non-null by the time it's persisted.
    session_id: uuid.UUID | None = Field(default=None, foreign_key="workout_sessions.id", index=True)
    exercise_id: uuid.UUID = Field(foreign_key="exercises.id", nullable=False, index=True)
    exercise_name_snapshot: str = Field(max_length=150, nullable=False)
    primary_muscle_snapshot: str = Field(sa_column=Column(String, nullable=False))
    exercise_order: int = Field(nullable=False)

    sets: list["SessionSet"] = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "order_by": "SessionSet.set_order",
            "cascade": "all, delete-orphan",
        }
    )


class SessionSet(SQLModel, table=True):
    """A structural clone of a PlanSet, with the weight engine's RESOLVED value
    cloned in (never the type/offset) — see session/services/session_lifecycle_service.py.

    client_idempotency_key supports offline sync: a client generates one per set
    while offline, and re-POSTing the same batch after a flaky retry is safe
    because of the partial-unique index below.
    """

    __tablename__ = "session_sets"
    __table_args__ = (
        Index(
            "uq_session_set_idempotency",
            "session_exercise_id",
            "client_idempotency_key",
            unique=True,
            postgresql_where=text("client_idempotency_key IS NOT NULL"),
            sqlite_where=text("client_idempotency_key IS NOT NULL"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, nullable=False)
    # See SessionExercise.session_id docstring for why this is Optional at the Python level.
    session_exercise_id: uuid.UUID | None = Field(default=None, foreign_key="session_exercises.id", index=True)
    set_order: int = Field(nullable=False)
    target_reps: int | None = Field(default=None)
    target_weight_kg: float | None = Field(default=None, description="Cloned RESOLVED weight, not type/offset.")
    actual_reps: int | None = Field(default=None)
    actual_weight_kg: float | None = Field(default=None)
    is_warmup: bool = Field(default=False, nullable=False)
    completed_at: datetime | None = Field(default=None)
    client_idempotency_key: str | None = Field(default=None, max_length=100, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
    )
