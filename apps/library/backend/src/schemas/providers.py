"""Pydantic schemas for ProviderSubscription entities."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProviderBase(BaseModel):
    """Base schema for provider subscription fields."""

    provider_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the streaming or media subscription provider.",
    )
    provider_type: str = Field(
        default="STREAMING",
        max_length=50,
        description="Type of provider (e.g. STREAMING, GAMING_PASS, BOOK_PASS).",
    )
    is_active: bool = Field(
        default=True,
        description="Whether this household provider subscription is active.",
    )
    icon_url: str | None = Field(
        default=None,
        max_length=1024,
        description="Optional icon or logo URL for the provider.",
    )


class ProviderCreate(ProviderBase):
    """Schema for creating a new provider subscription."""

    pass


class ProviderUpdate(BaseModel):
    """Schema for updating an existing provider subscription."""

    provider_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Updated provider name.",
    )
    provider_type: str | None = Field(
        default=None,
        max_length=50,
        description="Updated provider type.",
    )
    is_active: bool | None = Field(
        default=None,
        description="Updated active status flag.",
    )
    icon_url: str | None = Field(
        default=None,
        max_length=1024,
        description="Updated icon or logo URL.",
    )


class ProviderResponse(ProviderBase):
    """Schema for provider subscription response payloads."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    household_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
