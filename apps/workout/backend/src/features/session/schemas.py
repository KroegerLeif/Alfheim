import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel
from src.features.session.models import SessionStatus


class StartSessionRequest(SQLModel):
    plan_id: uuid.UUID | None = Field(default=None)
    plan_day_id: uuid.UUID | None = Field(default=None)


class SessionSetRead(SQLModel):
    id: uuid.UUID
    set_order: int
    target_reps: int | None
    target_weight_kg: float | None
    actual_reps: int | None
    actual_weight_kg: float | None
    is_warmup: bool
    completed_at: datetime | None
    client_idempotency_key: str | None


class SessionExerciseRead(SQLModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_name_snapshot: str
    primary_muscle_snapshot: str
    exercise_order: int
    sets: list[SessionSetRead]


class WorkoutSessionRead(SQLModel):
    id: uuid.UUID
    home_id: uuid.UUID
    user_id: uuid.UUID
    plan_id: uuid.UUID | None
    plan_day_label: str | None
    started_at: datetime
    completed_at: datetime | None
    status: SessionStatus
    notes: str | None
    exercises: list[SessionExerciseRead]


class SessionSetSyncItem(SQLModel):
    """One offline-recorded set. client_idempotency_key is required — it is what
    makes re-POSTing the same batch after a flaky retry safe (see session_sync_service.py)."""

    client_idempotency_key: str = Field(min_length=1, max_length=100)
    session_exercise_id: uuid.UUID
    set_order: int
    actual_reps: int | None = Field(default=None)
    actual_weight_kg: float | None = Field(default=None)
    is_warmup: bool = Field(default=False)
    completed_at: datetime | None = Field(default=None)


class SessionSetSyncRequest(SQLModel):
    items: list[SessionSetSyncItem]


class SessionSetSyncResponse(SQLModel):
    acked: list[str]
    server_ids: dict[str, uuid.UUID]
