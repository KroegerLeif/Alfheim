from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

SupplyItemName = Annotated[str, StringConstraints(min_length=1, max_length=200)]


class MaintenanceSubmission(BaseModel):
    device_id: int
    completed_step_ids: list[int] = Field(max_length=200)
    step_notes: str | None = Field(default=None, max_length=2000)
    performer: str = Field(min_length=1, max_length=150)
    supply_items: list[SupplyItemName] | None = Field(default=None, max_length=50)


class TaskStateUpdate(BaseModel):
    """Input schema for updating an individual step's inspection state."""

    comment: str | None = Field(default=None, max_length=2000)  # Free-text inspection note
    supply_needed_date: str | None = Field(default=None, max_length=32)  # Override the next-due date
    supply_item: str | None = Field(default=None, max_length=200)  # Override the supply item
