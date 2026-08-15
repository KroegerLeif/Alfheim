import uuid
from datetime import date, datetime

from pydantic import field_validator
from sqlmodel import Field, SQLModel

from src.features.inventory.models import InventoryTransactionType
from src.features.inventory.units import is_valid_unit
from src.features.locations.models import LocationRead
from src.features.products.schemas import ProductRead

# -------------------------------------------------------------
# Inventory Transaction / Ledger Schemas
# -------------------------------------------------------------


class InventoryTransactionCreate(SQLModel):
    """Schema for validating incoming inventory movement requests."""

    product_id: uuid.UUID = Field(
        description="UUID reference to the target product blueprint.",
    )
    location_id: uuid.UUID = Field(
        description="UUID reference to the target physical storage location.",
    )
    transaction_type: InventoryTransactionType = Field(
        description="Type of transaction (in, out, waste, reconciliation).",
    )
    quantity_input: float = Field(
        gt=0,
        description="Raw transaction quantity, must be strictly positive. The backend adjusts signs internally based on type.",
    )
    unit_input: str = Field(
        min_length=1,
        max_length=50,
        description="The raw unit inputted by the user (e.g. 'kg', 'g', 'ml', 'piece', 'pack').",
    )
    batch_code: str | None = Field(
        default=None,
        max_length=100,
        description="Optional batch or lot code to track specific stock groups.",
    )
    expiration_date: date | None = Field(
        default=None,
        description="Optional expiration date associated with this batch.",
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        description="Optional explanatory notes for audit trail records.",
    )

    @field_validator("unit_input")
    @classmethod
    def validate_unit_input(cls, v: str) -> str:
        """Validate syntactic correctness by checking if the unit is recognized by Pint."""
        normalized = v.strip().lower()
        if not is_valid_unit(normalized):
            raise ValueError(
                f"Unrecognized unit of measurement: '{v}'. Please provide a standard unit (e.g. g, kg, ml, l) or count unit (e.g. piece, pack, box)."
            )
        return normalized


class InventoryLedgerRead(SQLModel):
    """Schema for returning transaction log entries in API responses."""

    id: uuid.UUID
    product_id: uuid.UUID
    location_id: uuid.UUID
    transaction_type: InventoryTransactionType
    quantity: float
    quantity_input: float
    unit_input: str
    batch_code: str | None
    expiration_date: date | None
    notes: str | None
    created_at: datetime


# -------------------------------------------------------------
# Inventory State Schemas
# -------------------------------------------------------------


class InventoryStateRead(SQLModel):
    """Schema for returning cached inventory state details in API responses."""

    id: uuid.UUID
    product_id: uuid.UUID
    location_id: uuid.UUID
    quantity: float
    batch_code: str | None
    expiration_date: date | None
    created_at: datetime
    updated_at: datetime


class InventoryStateReadWithRelations(InventoryStateRead):
    """Enhanced inventory state response including nested product and location entities."""

    product: ProductRead | None = None
    location: LocationRead | None = None


# -------------------------------------------------------------
# Pull Engine & Summary Schemas
# -------------------------------------------------------------


class LowStockItem(SQLModel):
    """Schema representing a product that has fallen below its minimum stock threshold."""

    product: ProductRead
    current_stock: float


class ExpirationSummary(SQLModel):
    """Schema representing stock levels categorized by expiration status."""

    expired: list[InventoryStateReadWithRelations]
    valid: list[InventoryStateReadWithRelations]
    untracked: list[InventoryStateReadWithRelations]


# -------------------------------------------------------------
# Bulk Sync Schemas (i18n-ready)
# -------------------------------------------------------------


class BulkAddProductItem(SQLModel):
    """Schema for an individual item to be ingested in bulk from a shopping list."""

    shopping_item_id: uuid.UUID = Field(description="The unique identifier of the source shopping item.")
    name: str = Field(min_length=1, max_length=255, description="Name of the product.")
    brand: str | None = Field(default=None, max_length=255, description="Brand name of the product.")
    barcode: str | None = Field(default=None, description="Globally unique barcode if available.")
    quantity: float = Field(gt=0, description="Quantity of the item to add.")
    unit: str = Field(min_length=1, max_length=50, description="The unit of measurement (e.g. piece, kg, g, ml, l).")


class BulkAddInventoryPayload(SQLModel):
    """Schema for validating a list of bulk items to add to inventory."""

    items: list[BulkAddProductItem] = Field(description="List of purchased items to sync to the pantry.")


class BulkAddSuccessfulItem(SQLModel):
    """Schema for successfully synced items."""

    shopping_item_id: uuid.UUID
    product_id: uuid.UUID
    quantity_added: float
    unit: str


class BulkAddUnrecognizedItem(SQLModel):
    """Schema for unrecognized items returning standardized translatable reasons."""

    shopping_item_id: uuid.UUID
    name: str
    brand: str | None = None
    barcode: str | None = None
    quantity: float
    unit: str
    reason: str = Field(
        description="Standardized i18n translation key mapping to next-intl error details (e.g. 'pantry.error.product_not_found')."
    )


class BulkAddResponse(SQLModel):
    """Consolidated response payload for a bulk addition operation."""

    successful_items: list[BulkAddSuccessfulItem] = Field(default_factory=list)
    unrecognized_items: list[BulkAddUnrecognizedItem] = Field(default_factory=list)
