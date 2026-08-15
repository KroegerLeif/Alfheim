import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class ChoreTemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=150, description="Name of the chore template.")
    description: str | None = Field(default=None, max_length=500, description="Instructions/description.")
    points: int = Field(default=10, ge=0, description="Points awarded.")
    is_non_cumulative: bool = Field(default=True, description="Reset behaviour.")


class ChoreTemplateCreate(ChoreTemplateBase):
    pass


class ChoreTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    points: int | None = Field(default=None, ge=0)
    is_non_cumulative: bool | None = None


class ChoreTemplateRead(ChoreTemplateBase):
    id: uuid.UUID
    home_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ChoreInstanceRead(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    home_id: uuid.UUID
    assigned_to: uuid.UUID | None = None
    completed_by: uuid.UUID | None = None
    completed_at: datetime | None = None
    due_date: date
    status: str
    points_awarded: int
    created_at: datetime
    updated_at: datetime


class HouseholdStreakRead(BaseModel):
    id: uuid.UUID
    home_id: uuid.UUID
    current_streak: int
    longest_streak: int
    last_completed_date: date | None = None
    created_at: datetime
    updated_at: datetime


class ChoreAssignRequest(BaseModel):
    assigned_to: uuid.UUID | None = None


class ChoreCompleteRequest(BaseModel):
    completed_by: uuid.UUID | None = None
    completed_by_name: str | None = None


class ChoreTimelineRead(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    instance_id: uuid.UUID
    home_id: uuid.UUID
    completed_by: uuid.UUID
    completed_by_name: str | None = None
    completed_at: datetime
    points_awarded: int


class ChoreIntegrationSummary(BaseModel):
    home_id: uuid.UUID
    current_streak: int
    longest_streak: int
    today_completed_count: int
    today_pending_count: int
    today_total_count: int
    completion_rate: float
    today_chores: list[ChoreInstanceRead] = Field(default_factory=list)
