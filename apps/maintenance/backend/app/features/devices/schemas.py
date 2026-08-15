from pydantic import BaseModel, ConfigDict


class HouseholdRead(BaseModel):
    id: int
    name: str
    address: str | None = None
    model_config = ConfigDict(from_attributes=True)


class MaintenanceStepRead(BaseModel):
    id: int
    title: str
    description: str | None = None
    recurrence: int
    supply_item: str | None = None
    supply_needed_date: str | None = None
    last_completed: str | None = None
    device_id: int
    model_config = ConfigDict(from_attributes=True)


class ServiceHistoryEventRead(BaseModel):
    id: int
    date: str
    performer: str
    notes: str | None = None
    device_id: int
    completed_steps: list[str] | None = None
    model_config = ConfigDict(from_attributes=True)


class ServiceHistoryEventDetailRead(BaseModel):
    """Extended history event schema that includes denormalised device fields
    so the frontend /history endpoint never needs a second round-trip."""

    id: int
    date: str
    performer: str
    notes: str | None = None
    device_id: int
    device_name: str
    device_location: str
    completed_steps: list[str] | None = None
    model_config = ConfigDict(from_attributes=True)


class DeviceRead(BaseModel):
    id: int
    name: str
    model: str
    serial: str
    category: str
    location: str
    status: str
    service_interval_months: int | None = None
    notes: str | None = None
    household_id: int
    steps: list[MaintenanceStepRead] = []
    history_events: list[ServiceHistoryEventRead] = []
    model_config = ConfigDict(from_attributes=True)


class StepCreate(BaseModel):
    """Input schema for a single maintenance step during device creation."""

    title: str
    description: str | None = None
    recurrence: int  # interval in months
    supply_item: str | None = None


class DeviceCreate(BaseModel):
    """Input schema for the POST /api/v1/devices endpoint."""

    name: str
    model: str
    serial: str
    category: str
    location: str
    status: str = "active"
    service_interval_months: int | None = None
    notes: str | None = None
    household_id: int
    steps: list[StepCreate] = []
