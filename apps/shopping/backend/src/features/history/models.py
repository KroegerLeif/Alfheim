import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel, func


class ShoppingHistory(SQLModel, table=True):
    """Database model tracking frequently purchased items for quick-selection grids."""

    __tablename__ = "shopping_history"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )
    home_id: uuid.UUID = Field(
        index=True,
        nullable=False,
        description="History is scoped per home space.",
    )
    name: str = Field(
        min_length=1,
        max_length=255,
        description="Name of the item.",
    )
    brand: str = Field(
        default="",
        max_length=255,
        description="Brand name, defaults to empty string to ensure clean unique index matching (bypassing NULL constraint issues).",
    )
    barcode: str | None = Field(
        default=None,
        max_length=100,
        description="Optional barcode.",
    )
    unit: str = Field(
        default="piece",
        max_length=50,
        description="Last used unit of measurement.",
    )
    purchase_count: int = Field(
        default=1,
        nullable=False,
        description="Counter of purchases to prioritize quick-selection grids.",
    )
    icon_tag: str | None = Field(
        default=None,
        max_length=100,
        description="Translatable tag representing the item category icon (e.g., 'icon.grocery.milk').",
    )
    last_purchased_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )


# Unique index scoping name + brand within a household to prevent duplicate entries
Index(
    "uq_shopping_history_home_name_brand",
    ShoppingHistory.home_id,
    ShoppingHistory.name,
    ShoppingHistory.brand,
    unique=True,
)
