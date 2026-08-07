import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class ChoreTemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=150, description="Name of the chore template.")
    description: Optional[str] = Field(default=None, max_length=500, description="Instructions/description.")
    points: int = Field(default=10, ge=0, description="Points awarded.")
    is_non_cumulative: bool = Field(default=True, description="Reset behaviour.")


class ChoreTemplateCreate(ChoreTemplateBase):
    pass


class ChoreTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = Field(default=None, max_length=500)
    points: Optional[int] = Field(default=None, ge=0)
    is_non_cumulative: Optional[bool] = None


class ChoreTemplateRead(ChoreTemplateBase):
    id: uuid.UUID
    home_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ChoreInstanceRead(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    home_id: uuid.UUID
    assigned_to: Optional[uuid.UUID] = None
    completed_by: Optional[uuid.UUID] = None
    completed_at: Optional[datetime] = None
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
    last_completed_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class ChoreAssignRequest(BaseModel):
    assigned_to: Optional[uuid.UUID] = None


class ChoreCompleteRequest(BaseModel):
    completed_by: Optional[uuid.UUID] = None
    completed_by_name: Optional[str] = None


class ChoreTimelineRead(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    instance_id: uuid.UUID
    home_id: uuid.UUID
    completed_by: uuid.UUID
    completed_by_name: Optional[str] = None
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

