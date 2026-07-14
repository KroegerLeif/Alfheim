import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel, Relationship, func


class ShoppingList(SQLModel, table=True):
    """Database model for a shopping list shared within a household boundary."""

    __tablename__ = "shopping_lists"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the shopping list.",
    )
    name: str = Field(
        min_length=1,
        max_length=255,
        description="Name of the shopping list (e.g. Household, Private).",
    )
    home_id: uuid.UUID = Field(
        index=True,
        nullable=False,
        description="UUID of the home space (household) this list belongs to.",
    )
    owner_id: uuid.UUID = Field(
        nullable=False,
        description="UUID of the user who created the list.",
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

    # Relationships
    items: List["ShoppingItem"] = Relationship(
        back_populates="shopping_list",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "selectin"},
    )


class ShoppingItem(SQLModel, table=True):
    """Database model for an item on a shopping list."""

    __tablename__ = "shopping_items"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )
    list_id: uuid.UUID = Field(
        foreign_key="shopping_lists.id",
        nullable=False,
        index=True,
        description="Reference to the parent shopping list.",
    )
    name: str = Field(
        min_length=1,
        max_length=255,
        index=True,
        description="Name of the item.",
    )
    brand: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Optional brand name.",
    )
    barcode: Optional[str] = Field(
        default=None,
        max_length=100,
        index=True,
        description="Optional barcode (EAN/UPC).",
    )
    quantity: float = Field(
        default=1.0,
        description="Requested quantity.",
    )
    unit: str = Field(
        default="piece",
        max_length=50,
        description="Unit of measurement.",
    )
    is_completed: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="True if purchased and checked off the list.",
    )
    is_auto_generated: bool = Field(
        default=False,
        nullable=False,
        description="True if automatically generated from low-stock pantry items.",
    )
    is_synced: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="True if successfully synced ('eingelagert') to pantry inventory.",
    )
    product_id: Optional[uuid.UUID] = Field(
        default=None,
        nullable=True,
        description="Matched Pantry product UUID (hydrated after matching).",
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

    # Relationships
    shopping_list: Optional[ShoppingList] = Relationship(back_populates="items")
