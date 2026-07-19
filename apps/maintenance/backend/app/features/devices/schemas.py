from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class HouseholdRead(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class MaintenanceStepRead(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    recurrence: int
    supply_item: Optional[str] = None
    supply_needed_date: Optional[str] = None
    last_completed: Optional[str] = None
    device_id: int
    model_config = ConfigDict(from_attributes=True)

class ServiceHistoryEventRead(BaseModel):
    id: int
    date: str
    performer: str
    notes: Optional[str] = None
    device_id: int
    completed_steps: Optional[List[str]] = None
    model_config = ConfigDict(from_attributes=True)

class ServiceHistoryEventDetailRead(BaseModel):
    """Extended history event schema that includes denormalised device fields
    so the frontend /history endpoint never needs a second round-trip."""
    id: int
    date: str
    performer: str
    notes: Optional[str] = None
    device_id: int
    device_name: str
    device_location: str
    completed_steps: Optional[List[str]] = None
    model_config = ConfigDict(from_attributes=True)

class DeviceRead(BaseModel):
    id: int
    name: str
    model: str
    serial: str
    category: str
    location: str
    status: str
    service_interval_months: Optional[int] = None
    notes: Optional[str] = None
    household_id: int
    steps: List[MaintenanceStepRead] = []
    history_events: List[ServiceHistoryEventRead] = []
    model_config = ConfigDict(from_attributes=True)
