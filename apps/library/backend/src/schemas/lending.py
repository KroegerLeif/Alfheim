"""Pydantic schemas for Lending Record entities."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import LendingStatus


class LendItemRequest(BaseModel):
    """Schema for lending an item to a contact."""

    contact_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of person borrowing the item.",
    )
    due_date: datetime | None = Field(
        default=None,
        description="Optional due date for item return.",
    )
    notes: str | None = Field(
        default=None,
        max_length=1000,
        description="Optional notes regarding the loan.",
    )
    lent_at: datetime | None = Field(
        default=None,
        description="Optional timestamp when item was lent (defaults to current time).",
    )


class ReturnItemRequest(BaseModel):
    """Schema for returning a borrowed item."""

    returned_at: datetime | None = Field(
        default=None,
        description="Optional timestamp when item was returned (defaults to current time).",
    )
    notes: str | None = Field(
        default=None,
        max_length=1000,
        description="Optional additional notes upon return.",
    )


class LendingRecordResponse(BaseModel):
    """Schema for lending record response payloads."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    household_id: uuid.UUID
    item_id: uuid.UUID
    contact_name: str
    status: LendingStatus
    lent_at: datetime
    due_date: datetime | None = None
    returned_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class LendingRecordListResponse(BaseModel):
    """Paginated list response for lending records."""

    records: list[LendingRecordResponse]
    total: int
    skip: int
    limit: int
