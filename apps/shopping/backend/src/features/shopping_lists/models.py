import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Integer
from sqlmodel import Field, Relationship, SQLModel, func


class ShoppingList(SQLModel, table=True):
    """Database model for a shopping list shared within a household boundary.

    Two protected list types exist:
      - is_default=True  : the auto-provisioned Household List (one per home_id).
      - is_personal=True : the persistent Personal List (one per owner_id, shared
                           across households – home_id is set to the user's primary
                           household at creation time but the list always follows the user).
    Both flags prevent deletion via the API.
    """

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
        description="Display name of the shopping list (e.g. 'Haushalt', 'Max - Liste').",
    )
    home_id: uuid.UUID = Field(
        index=True,
        nullable=False,
        description="UUID of the home space (household) this list belongs to.",
    )
    owner_id: uuid.UUID = Field(
        nullable=False,
        index=True,
        description="UUID of the user who created or owns the list.",
    )
    is_default: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
        description="True for the auto-provisioned shared Household List (non-deletable).",
    )
    is_personal: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
        description="True for the user's persistent Personal List (non-deletable, user-bound).",
    )
    position: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default="0"),
        description="Display position index for custom list reordering.",
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

    # Relationships
    items: list["ShoppingItem"] = Relationship(
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
    brand: str | None = Field(
        default=None,
        max_length=255,
        description="Optional brand name.",
    )
    barcode: str | None = Field(
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
    product_id: uuid.UUID | None = Field(
        default=None,
        nullable=True,
        description="Matched Pantry product UUID (hydrated after matching).",
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

    # Relationships
    shopping_list: ShoppingList | None = Relationship(back_populates="items")
