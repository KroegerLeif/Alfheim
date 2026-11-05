"""Pydantic request and response schemas of the chore feature."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class ChoreTemplateBase(BaseModel):
    """Fields shared by chore template create and read schemas."""

    name: str = Field(min_length=1, max_length=150, description="Name of the chore template.")
    description: str | None = Field(default=None, max_length=500, description="Instructions/description.")
    points: int = Field(default=10, ge=0, description="Points awarded.")
    is_non_cumulative: bool = Field(default=True, description="Reset behaviour.")


class ChoreTemplateCreate(ChoreTemplateBase):
    """Request body for creating a chore template."""

    pass


class ChoreTemplateUpdate(BaseModel):
    """Partial update of a chore template; omitted fields stay unchanged."""

    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    points: int | None = Field(default=None, ge=0)
    is_non_cumulative: bool | None = None


class ChoreTemplateRead(ChoreTemplateBase):
    """Chore template as returned by the API."""

    id: uuid.UUID
    home_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ChoreInstanceRead(BaseModel):
    """A chore scheduled for one day, with assignee and completion state."""

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
    """Household-wide completion streak counters."""

    id: uuid.UUID
    home_id: uuid.UUID
    current_streak: int
    longest_streak: int
    last_completed_date: date | None = None
    created_at: datetime
    updated_at: datetime


class ChoreAssignRequest(BaseModel):
    """Request body for assigning a chore instance; ``assigned_to=None`` releases it."""

    assigned_to: uuid.UUID | None = None


class ChoreTimelineRead(BaseModel):
    """One completion entry in a chore template's history."""

    id: uuid.UUID
    template_id: uuid.UUID
    instance_id: uuid.UUID
    home_id: uuid.UUID
    completed_by: uuid.UUID
    completed_by_name: str | None = None
    completed_at: datetime
    points_awarded: int


class ChoreIntegrationSummary(BaseModel):
    """Compact daily status of a household used by the dashboard and MCP overview."""

    home_id: uuid.UUID
    current_streak: int
    longest_streak: int
    today_completed_count: int
    today_pending_count: int
    today_total_count: int
    completion_rate: float
    today_chores: list[ChoreInstanceRead] = Field(default_factory=list)
