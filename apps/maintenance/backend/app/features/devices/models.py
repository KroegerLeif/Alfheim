from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class Household(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    address: Optional[str] = None

    # Relationship back to devices
    devices: List["Device"] = Relationship(
        back_populates="household",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class Device(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    model: str
    serial: str
    category: str
    location: str
    status: str  # active, maintenance, inactive
    service_interval_months: Optional[int] = None
    notes: Optional[str] = None
    household_id: int = Field(foreign_key="household.id")

    # Relationships
    household: Household = Relationship(back_populates="devices")
    steps: List["MaintenanceStep"] = Relationship(
        back_populates="device",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    history_events: List["ServiceHistoryEvent"] = Relationship(
        back_populates="device",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

# Avoid circular imports for type hints
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
