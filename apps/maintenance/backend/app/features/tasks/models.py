from typing import Optional, List
from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field, Relationship

class MaintenanceStep(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    recurrence: int  # in months
    supply_item: Optional[str] = None
    supply_needed_date: Optional[str] = None
    last_completed: Optional[str] = None
    device_id: int = Field(foreign_key="device.id")

    # Relationship back to device
    device: "Device" = Relationship(back_populates="steps")

class ServiceHistoryEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    performer: str
    notes: Optional[str] = None
    device_id: int = Field(foreign_key="device.id")

    # Capture completed steps list as JSON block in Postgres
    completed_steps: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Relationship back to device
    device: "Device" = Relationship(back_populates="history_events")

# Avoid circular imports for type hints
from app.features.devices.models import Device
