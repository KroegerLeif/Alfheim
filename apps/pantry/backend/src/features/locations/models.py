import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel, func


class LocationBase(SQLModel):
    """Base schema containing fields shared across all Location schemas."""
    name: str = Field(
        index=True,
        min_length=1,
        max_length=100,
        description="Name of the physical storage location.",
    )
    description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional description/details of the location.",
    )


class LocationCreate(LocationBase):
    """Schema for creating a new Location.

    Only accepts fields from LocationBase to prevent clients from
    injecting read-only database fields (ID, system status, timestamps).
    """
    pass


class LocationUpdate(SQLModel):
    """Schema for partially updating an existing Location (PATCH).

    All fields are optional to allow partial updates.
    """
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Updated name of the location.",
    )
    description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Updated description of the location.",
    )


class LocationRead(LocationBase):
    """Schema for returning location details in API responses.

    Includes all database-generated fields and system metadata.
    """
    id: uuid.UUID
    is_system: bool
    owner_id: Optional[uuid.UUID]
    home_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class Location(LocationBase, table=True):
    """The database table model for locations."""
    __tablename__ = "locations"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the location.",
    )
    is_system: bool = Field(
        default=False,
        nullable=False,
        description="If True, this is a system-level location (e.g. Backlog) and cannot be deleted or renamed.",
    )
    owner_id: Optional[uuid.UUID] = Field(
        default=None,
        nullable=True,
        description="UUID of the user who owns/created the location.",
    )
    home_id: Optional[uuid.UUID] = Field(
        default=None,
        nullable=True,
        description="UUID of the home space this location belongs to.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp of creation, stored in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
        description="Timestamp of last update, stored in UTC.",
    )
