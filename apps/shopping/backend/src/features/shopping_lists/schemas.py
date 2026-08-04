import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


# -------------------------------------------------------------
# Shopping Item Lifecycle Schemas
# -------------------------------------------------------------

class ShoppingItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Name of the item.")
    brand: Optional[str] = Field(default=None, max_length=255, description="Optional brand name.")
    barcode: Optional[str] = Field(default=None, max_length=100, description="Optional barcode (EAN/UPC).")
    quantity: float = Field(default=1.0, gt=0, description="Requested quantity.")
    unit: str = Field(default="piece", max_length=50, description="Unit of measurement.")


class ShoppingItemCreate(ShoppingItemBase):
    pass


class PushItemPayload(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Name of the item.")
    brand: Optional[str] = Field(default=None, max_length=255)
    barcode: Optional[str] = Field(default=None, max_length=100)
    quantity: float = Field(default=1.0, gt=0)
    unit: str = Field(default="piece", max_length=50)
    product_id: Optional[uuid.UUID] = Field(default=None)
    list_id: Optional[uuid.UUID] = Field(default=None)


class ShoppingItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=255)
    barcode: Optional[str] = Field(default=None, max_length=100)
    quantity: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = Field(default=None, max_length=50)
    is_completed: Optional[bool] = Field(default=None)


class ShoppingItemRead(ShoppingItemBase):
    id: uuid.UUID
    list_id: uuid.UUID
    is_completed: bool
    is_auto_generated: bool
    is_synced: bool
    product_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Shopping List Lifecycle Schemas
# -------------------------------------------------------------

class ShoppingListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Name of the shopping list.")


class ShoppingListRead(BaseModel):
    id: uuid.UUID
    name: str
    home_id: uuid.UUID
    owner_id: uuid.UUID
    is_default: bool
    is_personal: bool
    created_at: datetime
    updated_at: datetime
    items: List[ShoppingItemRead] = Field(default_factory=list)

    @field_validator("items", mode="before")
    @classmethod
    def default_items(cls, v):
        return v if v is not None else []

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Sync and Integration Schemas (i18n-ready)
# -------------------------------------------------------------

class UnrecognizedShoppingItem(BaseModel):
    """Payload representing an item the Pantry backend could not resolve."""
    shopping_item_id: uuid.UUID
    name: str
    brand: Optional[str] = None
    barcode: Optional[str] = None
    quantity: float
    unit: str
    reason: str = Field(
        description="Standardized translatable i18n error key (e.g. 'pantry.error.product_not_found')."
    )


class SyncToPantryResponse(BaseModel):
    """JSON response returned to the client summarizing the sync status."""
    status: str = Field(description="Overall status of the sync (e.g., 'success', 'partial_success').")
    synced_count: int = Field(description="Number of items successfully synced and stocked.")
    unrecognized_count: int = Field(description="Number of items unrecognized or invalid.")
    unrecognized_items: List[UnrecognizedShoppingItem] = Field(
        default_factory=list,
        description="List of items requiring manual classification or ignore options."
    )


class HouseholdRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

