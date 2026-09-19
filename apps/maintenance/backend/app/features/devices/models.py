import uuid

from sqlmodel import Field, Relationship, SQLModel


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
    # Household owned by the household app (core/household); membership is checked per request,
    # so this is a plain indexed UUID column without a local foreign key.
    household_id: uuid.UUID = Field(index=True)

    # Relationships
    steps: list["MaintenanceStep"] = Relationship(
        back_populates="device", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    history_events: list["ServiceHistoryEvent"] = Relationship(
        back_populates="device", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


# Avoid circular imports for type hints
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent
