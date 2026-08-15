from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent


class Household(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    address: str | None = None

    # Relationship back to devices
    devices: list["Device"] = Relationship(
        back_populates="household", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Device(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    model: str
    serial: str
    category: str
    location: str
    status: str  # active, maintenance, inactive
    service_interval_months: int | None = None
    notes: str | None = None
    household_id: int = Field(foreign_key="household.id")

    # Relationships
    household: Household = Relationship(back_populates="devices")
    steps: list["MaintenanceStep"] = Relationship(
        back_populates="device", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    history_events: list["ServiceHistoryEvent"] = Relationship(
        back_populates="device", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
