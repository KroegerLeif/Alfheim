"""Pydantic schemas for Location entities."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LocationBase(BaseModel):
    """Base schema for location fields."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the physical location.",
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Optional description of the location.",
    )
    parent_id: uuid.UUID | None = Field(
        default=None,
        description="Optional parent location UUID for hierarchical grouping.",
    )


class LocationCreate(LocationBase):
    """Schema for creating a new location."""

    pass


class LocationUpdate(BaseModel):
    """Schema for updating an existing location."""

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Updated name of the location.",
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Updated description of the location.",
    )
    parent_id: uuid.UUID | None = Field(
        default=None,
        description="Updated parent location UUID.",
    )


class LocationResponse(LocationBase):
    """Schema for location response payloads."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    household_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class LocationTreeNode(LocationResponse):
    """Schema for hierarchical tree nodes of locations."""

    children: list["LocationTreeNode"] = Field(
        default_factory=list,
        description="Nested child locations.",
    )
