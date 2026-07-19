from pydantic import BaseModel
from typing import List, Optional

class MaintenanceSubmission(BaseModel):
    device_id: int
    completed_step_ids: List[int]
    step_notes: Optional[str] = None
    performer: str
    supply_items: Optional[List[str]] = None
