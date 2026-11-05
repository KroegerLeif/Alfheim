"""SQLModel tables for maintenance steps and service history events."""

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship, SQLModel


class MaintenanceStep(SQLModel, table=True):
    """A recurring maintenance task of a device; ``recurrence`` is the interval in months."""

    id: int | None = Field(default=None, primary_key=True)
    title: str
    description: str | None = None
    recurrence: int  # in months
    supply_item: str | None = None
    supply_needed_date: str | None = None
    last_completed: str | None = None
    device_id: int = Field(foreign_key="device.id")

    # Relationship back to device
    device: "Device" = Relationship(back_populates="steps")


class ServiceHistoryEvent(SQLModel, table=True):
    """A recorded service visit for a device, including the steps completed during it."""

    id: int | None = Field(default=None, primary_key=True)
    date: str
    performer: str
    notes: str | None = None
    device_id: int = Field(foreign_key="device.id")

    # Capture completed steps list as JSON block in Postgres
    completed_steps: list[str] | None = Field(default=None, sa_column=Column(JSON))

    # Relationship back to device
    device: "Device" = Relationship(back_populates="history_events")


# Avoid circular imports for type hints
from app.features.devices.models import Device
