"""Pydantic schemas for Item entities."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import LendingStatus, MediaType


class ItemBase(BaseModel):
    """Base schema for item fields."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Title of the media item.",
    )
    media_type: MediaType = Field(
        ...,
        description="Type of media item (BOOK, GAME, MOVIE, SERIES).",
    )
    location_id: uuid.UUID | None = Field(
        default=None,
        description="Optional location UUID where the item is stored.",
    )
    author_creator: str | None = Field(
        default=None,
        max_length=255,
        description="Author, creator, developer, or director.",
    )
    description: str | None = Field(
        default=None,
        description="Optional extended description.",
    )
    is_cookbook: bool = Field(
        default=False,
        description="Whether the item is a cookbook.",
    )
    isbn_gtin: str | None = Field(
        default=None,
        max_length=50,
        description="ISBN, EAN, or GTIN identifier.",
    )
    min_players: int | None = Field(
        default=None,
        ge=1,
        description="Minimum number of players for games.",
    )
    max_players: int | None = Field(
        default=None,
        ge=1,
        description="Maximum number of players for games.",
    )
    runtime_minutes: int | None = Field(
        default=None,
        ge=1,
        description="Runtime or playing time in minutes.",
    )
    fsk_rating: int | None = Field(
        default=None,
        ge=0,
        le=18,
        description="Age rating classification.",
    )
    cover_image_url: str | None = Field(
        default=None,
        max_length=1024,
        description="URL for cover artwork image.",
    )
    provider_id: uuid.UUID | None = Field(
        default=None,
        description="Optional digital provider subscription UUID.",
    )


class ItemCreate(ItemBase):
    """Schema for creating a new item."""

    pass


class ItemUpdate(BaseModel):
    """Schema for updating an existing item."""

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Updated title.",
    )
    media_type: MediaType | None = Field(
        default=None,
        description="Updated media type.",
    )
    location_id: uuid.UUID | None = Field(
        default=None,
        description="Updated location UUID.",
    )
    author_creator: str | None = Field(
        default=None,
        max_length=255,
        description="Updated author/creator.",
    )
    description: str | None = Field(
        default=None,
        description="Updated description.",
    )
    is_cookbook: bool | None = Field(
        default=None,
        description="Updated cookbook flag.",
    )
    isbn_gtin: str | None = Field(
        default=None,
        max_length=50,
        description="Updated ISBN/GTIN.",
    )
    min_players: int | None = Field(
        default=None,
        ge=1,
        description="Updated min players.",
    )
    max_players: int | None = Field(
        default=None,
        ge=1,
        description="Updated max players.",
    )
    runtime_minutes: int | None = Field(
        default=None,
        ge=1,
        description="Updated runtime in minutes.",
    )
    fsk_rating: int | None = Field(
        default=None,
        ge=0,
        le=18,
        description="Updated FSK rating.",
    )
    cover_image_url: str | None = Field(
        default=None,
        max_length=1024,
        description="Updated cover image URL.",
    )
    provider_id: uuid.UUID | None = Field(
        default=None,
        description="Updated provider subscription UUID.",
    )


class ItemResponse(ItemBase):
    """Schema for item response payloads."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    household_id: uuid.UUID
    status: LendingStatus
    manual_s3_key: str | None = None
    created_at: datetime
    updated_at: datetime


class ItemListResponse(BaseModel):
    """Paginated list response for items."""

    items: list[ItemResponse]
    total: int
    skip: int
    limit: int
