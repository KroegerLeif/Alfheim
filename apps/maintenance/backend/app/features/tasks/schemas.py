from pydantic import BaseModel
from typing import List, Optional

class MaintenanceSubmission(BaseModel):
    device_id: int
    completed_step_ids: List[int]
    step_notes: Optional[str] = None
    performer: str
    supply_items: Optional[List[str]] = None


class TaskStateUpdate(BaseModel):
    """Input schema for updating an individual step's inspection state."""
    comment: Optional[str] = None          # Free-text inspection note
    supply_needed_date: Optional[str] = None  # Override the next-due date
    supply_item: Optional[str] = None      # Override the supply item
