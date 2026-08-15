from pydantic import BaseModel


class MaintenanceSubmission(BaseModel):
    device_id: int
    completed_step_ids: list[int]
    step_notes: str | None = None
    performer: str
    supply_items: list[str] | None = None


class TaskStateUpdate(BaseModel):
    """Input schema for updating an individual step's inspection state."""

    comment: str | None = None  # Free-text inspection note
    supply_needed_date: str | None = None  # Override the next-due date
    supply_item: str | None = None  # Override the supply item
