"""Pydantic request and response schemas of the shopping list feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# -------------------------------------------------------------
# Shopping Item Lifecycle Schemas
# -------------------------------------------------------------


class ShoppingItemBase(BaseModel):
    """Fields shared by shopping item create and read schemas."""

    name: str = Field(min_length=1, max_length=255, description="Name of the item.")
    brand: str | None = Field(default=None, max_length=255, description="Optional brand name.")
    barcode: str | None = Field(default=None, max_length=100, description="Optional barcode (EAN/UPC).")
    quantity: float = Field(default=1.0, gt=0, description="Requested quantity.")
    unit: str = Field(default="piece", max_length=50, description="Unit of measurement.")


class ShoppingItemCreate(ShoppingItemBase):
    """Request body for adding an item to a list."""

    pass


class PushItemPayload(BaseModel):
    """Request body for pushing an item to a list, optionally linked to a Pantry product."""

    name: str = Field(min_length=1, max_length=255, description="Name of the item.")
    brand: str | None = Field(default=None, max_length=255)
    barcode: str | None = Field(default=None, max_length=100)
    quantity: float = Field(default=1.0, gt=0)
    unit: str = Field(default="piece", max_length=50)
    product_id: uuid.UUID | None = Field(default=None)
    list_id: uuid.UUID | None = Field(default=None)


class ShoppingItemUpdate(BaseModel):
    """Partial update of a shopping item; omitted fields stay unchanged."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=255)
    barcode: str | None = Field(default=None, max_length=100)
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=50)
    is_completed: bool | None = Field(default=None)


class ShoppingItemRead(ShoppingItemBase):
    """Shopping item as returned by the API."""

    id: uuid.UUID
    list_id: uuid.UUID
    is_completed: bool
    is_auto_generated: bool
    is_synced: bool
    product_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Shopping List Lifecycle Schemas
# -------------------------------------------------------------


class ShoppingListCreate(BaseModel):
    """Request body for creating a shopping list."""

    name: str = Field(min_length=1, max_length=255, description="Name of the shopping list.")


class ReorderListsPayload(BaseModel):
    """Request body carrying the new display order of lists."""

    list_ids: list[uuid.UUID] = Field(description="Ordered list of Shopping List UUIDs.")


class ShoppingListRead(BaseModel):
    """Shopping list with its items as returned by the API."""

    id: uuid.UUID
    name: str
    home_id: uuid.UUID
    owner_id: uuid.UUID
    is_default: bool
    is_personal: bool
    position: int
    created_at: datetime
    updated_at: datetime
    items: list[ShoppingItemRead] = Field(default_factory=list)

    @field_validator("items", mode="before")
    @classmethod
    def default_items(cls, v):
        """Coerce a missing ``items`` value to an empty list."""
        return v if v is not None else []

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Sync and Integration Schemas (i18n-ready)
# -------------------------------------------------------------


class UnrecognizedShoppingItem(BaseModel):
    """Payload representing an item the Pantry backend could not resolve."""

    shopping_item_id: uuid.UUID
    name: str
    brand: str | None = None
    barcode: str | None = None
    quantity: float
    unit: str
    reason: str = Field(description="Standardized translatable i18n error key (e.g. 'pantry.error.product_not_found').")


class SyncToPantryRequest(BaseModel):
    """Optional body of the sync endpoint that narrows the sync to specific items."""

    item_ids: list[uuid.UUID] | None = Field(
        default=None,
        description=(
            "Restrict the sync to these completed, unsynced items of the list. "
            "Used to retry items the first sync could not match after their catalog entry was created."
        ),
    )


class SyncToPantryResponse(BaseModel):
    """JSON response returned to the client summarizing the sync status."""

    status: str = Field(description="Overall status of the sync (e.g., 'success', 'partial_success').")
    synced_count: int = Field(description="Number of items successfully synced and stocked.")
    unrecognized_count: int = Field(description="Number of items unrecognized or invalid.")
    unrecognized_items: list[UnrecognizedShoppingItem] = Field(
        default_factory=list, description="List of items requiring manual classification or ignore options."
    )


class HouseholdRead(BaseModel):
    """Household the caller belongs to, as reported by the household API."""

    id: uuid.UUID
    name: str
    slug: str
    role: str | None = None
    is_default: bool = False
