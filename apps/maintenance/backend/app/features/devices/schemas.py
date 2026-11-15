"""API schemas for devices, their maintenance steps and service history."""

import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator


class HouseholdRead(BaseModel):
    """The household of the current request. Households (names, members) are owned by core/household."""

    id: uuid.UUID
    name: str
    address: str | None = None
    model_config = ConfigDict(from_attributes=True)


class MaintenanceStepRead(BaseModel):
    """A recurring maintenance step of a device as returned by the API."""

    id: int
    title: str
    description: str | None = None
    comment: str | None = None
    recurrence: int
    supply_item: str | None = None
    supply_needed_date: str | None = None
    last_completed: str | None = None
    device_id: int
    model_config = ConfigDict(from_attributes=True)


class ServiceHistoryEventRead(BaseModel):
    """A completed service event of a device as returned by the API."""

    id: int
    date: str
    performer: str
    notes: str | None = None
    device_id: int
    completed_steps: list[str] | None = None
    model_config = ConfigDict(from_attributes=True)


class ServiceHistoryEventDetailRead(BaseModel):
    """Extended history event schema with denormalised device fields.

    The frontend /history endpoint therefore never needs a second round-trip.
    """

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
    """A device with its maintenance steps and service history as returned by the API."""

    id: int
    name: str
    model: str
    serial: str
    category: str
    location: str
    status: str
    service_interval_months: int | None = None
    notes: str | None = None
    household_id: uuid.UUID
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
    # No household_id: devices are always created in the X-Household-ID household
    # (unknown fields such as a legacy household_id are ignored).
    steps: list[StepCreate] = []


def _reject_explicit_nulls(model: BaseModel, fields: frozenset[str]) -> None:
    """Raise when one of ``fields`` was sent as ``null``; ``None`` otherwise means "omitted"."""
    nulls = sorted(name for name in fields if name in model.model_fields_set and getattr(model, name) is None)
    if nulls:
        raise ValueError(f"these fields cannot be null: {', '.join(nulls)}")


class DeviceUpdate(BaseModel):
    """Partial update for PATCH /api/v1/devices/{device_id}; omitted fields stay unchanged."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    serial: str | None = Field(default=None, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    status: str | None = Field(default=None, min_length=1, max_length=50)
    service_interval_months: int | None = Field(default=None, ge=1, le=600)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "DeviceUpdate":
        """Reject ``null`` for columns that cannot be empty; ``notes`` and the interval may be cleared."""
        _reject_explicit_nulls(self, frozenset({"name", "model", "serial", "category", "location", "status"}))
        return self


class StepUpdate(BaseModel):
    """Partial update for PATCH /api/v1/devices/{device_id}/steps/{step_id}; omitted fields stay unchanged."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    recurrence: int | None = Field(default=None, ge=1, le=600)  # interval in months
    supply_item: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "StepUpdate":
        """Reject ``null`` for the title and the interval; description and supply item may be cleared."""
        _reject_explicit_nulls(self, frozenset({"title", "recurrence"}))
        return self
