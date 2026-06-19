import enum
import uuid
from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import Column, DateTime, Date, String, Index, text
from sqlmodel import Field, SQLModel, func


class InventoryTransactionType(str, enum.Enum):
    """Supported types of inventory movements."""

    IN = "in"
    OUT = "out"
    WASTE = "waste"
    RECONCILIATION = "reconciliation"


class InventoryLedger(SQLModel, table=True):
    """Immutable transaction ledger of all physical stock movements."""

    __tablename__ = "inventory_ledger"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for this transaction event.",
    )
    product_id: uuid.UUID = Field(
        foreign_key="products.id",
        nullable=False,
        index=True,
        description="Reference to the product blueprint.",
    )
    location_id: uuid.UUID = Field(
        foreign_key="locations.id",
        nullable=False,
        index=True,
        description="Reference to the physical storage location.",
    )
    transaction_type: InventoryTransactionType = Field(
        sa_column=Column(String, nullable=False),
        description="Type of inventory transaction.",
    )
    quantity: float = Field(
        nullable=False,
        description="Quantity of item moved, normalized strictly to product's base unit.",
    )
    quantity_input: float = Field(
        nullable=False,
        description="The raw, un-normalized quantity inputted by the user.",
    )
    unit_input: str = Field(
        max_length=50,
        nullable=False,
        description="The raw unit inputted by the user (e.g. 'kg', 'g', 'pack').",
    )
    batch_code: Optional[str] = Field(
        default=None,
        max_length=100,
        nullable=True,
        index=True,
        description="Optional code for tracking batch/lot specific inventory.",
    )
    expiration_date: Optional[date] = Field(
        default=None,
        sa_column=Column(Date, nullable=True),
        index=True,
        description="Optional expiration date of this batch.",
    )
    notes: Optional[str] = Field(
        default=None,
        max_length=500,
        nullable=True,
        description="Optional note describing the reason or details of this movement.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp of the transaction, stored in UTC.",
    )


class InventoryState(SQLModel, table=True):
    """Real-time cache storing consolidated stock levels per product/location/batch."""

    __tablename__ = "inventory_state"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for this inventory state record.",
    )
    product_id: uuid.UUID = Field(
        foreign_key="products.id",
        nullable=False,
        index=True,
        description="Reference to the product blueprint.",
    )
    location_id: uuid.UUID = Field(
        foreign_key="locations.id",
        nullable=False,
        index=True,
        description="Reference to the physical storage location.",
    )
    quantity: float = Field(
        default=0.0,
        nullable=False,
        description="Current stock level, normalized strictly to product's base unit.",
    )
    batch_code: Optional[str] = Field(
        default=None,
        max_length=100,
        nullable=True,
        index=True,
        description="Optional batch code.",
    )
    expiration_date: Optional[date] = Field(
        default=None,
        sa_column=Column(Date, nullable=True),
        index=True,
        description="Optional expiration date.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )


# ----------------------------------------------------------------------
# Database Unique Constraints (Prevent duplicates in State Cache)
# ----------------------------------------------------------------------

# 1. Unique constraint when both batch_code and expiration_date are NOT NULL
Index(
    "uq_state_product_location_batch_expiry",
    InventoryState.product_id,
    InventoryState.location_id,
    InventoryState.batch_code,
    InventoryState.expiration_date,
    unique=True,
    postgresql_where=text("batch_code IS NOT NULL AND expiration_date IS NOT NULL"),
    sqlite_where=text("batch_code IS NOT NULL AND expiration_date IS NOT NULL"),
)

# 2. Unique constraint when batch_code is NOT NULL and expiration_date IS NULL
Index(
    "uq_state_product_location_batch_only",
    InventoryState.product_id,
    InventoryState.location_id,
    InventoryState.batch_code,
    unique=True,
    postgresql_where=text("batch_code IS NOT NULL AND expiration_date IS NULL"),
    sqlite_where=text("batch_code IS NOT NULL AND expiration_date IS NULL"),
)

# 3. Unique constraint when expiration_date is NOT NULL and batch_code IS NULL
Index(
    "uq_state_product_location_expiry_only",
    InventoryState.product_id,
    InventoryState.location_id,
    InventoryState.expiration_date,
    unique=True,
    postgresql_where=text("batch_code IS NULL AND expiration_date IS NOT NULL"),
    sqlite_where=text("batch_code IS NULL AND expiration_date IS NOT NULL"),
)

# 4. Unique constraint when both batch_code and expiration_date are NULL
Index(
    "uq_state_product_location_default",
    InventoryState.product_id,
    InventoryState.location_id,
    unique=True,
    postgresql_where=text("batch_code IS NULL AND expiration_date IS NULL"),
    sqlite_where=text("batch_code IS NULL AND expiration_date IS NULL"),
)
