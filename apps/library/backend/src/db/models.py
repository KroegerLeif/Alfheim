"""Database models for the Library application."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, Relationship, SQLModel, func


class MediaType(str, Enum):
    """Supported types of media items in the library."""

    BOOK = "BOOK"
    GAME = "GAME"
    MOVIE = "MOVIE"
    SERIES = "SERIES"


class LendingStatus(str, Enum):
    """Lending availability status of a library item."""

    AVAILABLE = "AVAILABLE"
    LENT_OUT = "LENT_OUT"


class Location(SQLModel, table=True):
    """Hierarchical storage location model (e.g., Room -> Bookshelf -> Box)."""

    __tablename__ = "locations"
    __table_args__ = (
        Index("ix_locations_household_id_name", "household_id", "name"),
        Index("ix_locations_household_id_parent_id", "household_id", "parent_id"),
    )

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the location.",
    )
    household_id: uuid.UUID = Field(
        nullable=False,
        index=True,
        description="Household UUID enforcing multi-tenant isolation.",
    )
    name: str = Field(
        min_length=1,
        max_length=100,
        description="Name of the physical location (e.g., 'Living Room').",
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Optional detailed description of the location.",
    )
    parent_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="locations.id",
        nullable=True,
        description="Optional parent location ID for hierarchical nesting.",
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

    # Self-referential hierarchy relationships
    parent: "Location" = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Location.id", "lazy": "selectin"},
    )
    children: list["Location"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "selectin"},
    )

    # Items stored at this location
    items: list["Item"] = Relationship(
        back_populates="location",
        sa_relationship_kwargs={"lazy": "selectin"},
    )


class Item(SQLModel, table=True):
    """Database model for a media item (Book, Game, Movie, Series)."""

    __tablename__ = "items"
    __table_args__ = (
        Index("ix_items_household_id_media_type", "household_id", "media_type"),
        Index("ix_items_household_id_location_id", "household_id", "location_id"),
        Index("ix_items_household_id_status", "household_id", "status"),
        Index("ix_items_household_id_is_cookbook", "household_id", "is_cookbook"),
    )

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the media item.",
    )
    household_id: uuid.UUID = Field(
        nullable=False,
        index=True,
        description="Household UUID enforcing multi-tenant isolation.",
    )
    location_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="locations.id",
        nullable=True,
        index=True,
        description="Optional location reference where the item is stored.",
    )
    title: str = Field(
        min_length=1,
        max_length=255,
        index=True,
        description="Title of the media item.",
    )
    media_type: MediaType = Field(
        nullable=False,
        index=True,
        description="Category/Type of media item (BOOK, GAME, MOVIE, SERIES).",
    )
    author_creator: str | None = Field(
        default=None,
        max_length=255,
        description="Author, creator, developer, or director name.",
    )
    description: str | None = Field(
        default=None,
        description="Optional extended description or plot summary.",
    )
    is_cookbook: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="Flag indicating if the item is a cookbook.",
    )
    isbn_gtin: str | None = Field(
        default=None,
        max_length=50,
        index=True,
        description="Optional ISBN, EAN, or GTIN identifier code.",
    )
    min_players: int | None = Field(
        default=None,
        description="Minimum player count for games.",
    )
    max_players: int | None = Field(
        default=None,
        description="Maximum player count for games.",
    )
    runtime_minutes: int | None = Field(
        default=None,
        description="Runtime in minutes for movies/series or playing time for games.",
    )
    fsk_rating: int | None = Field(
        default=None,
        description="Age classification / FSK rating integer.",
    )
    status: LendingStatus = Field(
        default=LendingStatus.AVAILABLE,
        nullable=False,
        index=True,
        description="Current lending status (AVAILABLE or LENT_OUT).",
    )
    cover_image_url: str | None = Field(
        default=None,
        max_length=1024,
        description="URL for cover artwork image.",
    )
    manual_s3_key: str | None = Field(
        default=None,
        max_length=1024,
        description="S3 storage object key for uploaded PDF game manual.",
    )
    provider_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="provider_subscriptions.id",
        nullable=True,
        index=True,
        description="Optional digital streaming provider subscription reference.",
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
    location: Location | None = Relationship(
        back_populates="items",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    provider: "ProviderSubscription" = Relationship(
        back_populates="items",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    lending_records: list["LendingRecord"] = Relationship(
        back_populates="item",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "selectin"},
    )


class LendingRecord(SQLModel, table=True):
    """Record tracking an item lent out to a contact."""

    __tablename__ = "lending_records"
    __table_args__ = (
        Index("ix_lending_records_household_id_item_id", "household_id", "item_id"),
        Index("ix_lending_records_household_id_status", "household_id", "status"),
    )

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the lending record.",
    )
    household_id: uuid.UUID = Field(
        nullable=False,
        index=True,
        description="Household UUID enforcing multi-tenant isolation.",
    )
    item_id: uuid.UUID = Field(
        foreign_key="items.id",
        nullable=False,
        index=True,
        description="Reference to the lent media item.",
    )
    contact_name: str = Field(
        min_length=1,
        max_length=255,
        description="Name of the person borrowing the item.",
    )
    status: LendingStatus = Field(
        default=LendingStatus.LENT_OUT,
        nullable=False,
        index=True,
        description="Lending record status (LENT_OUT or returned/AVAILABLE).",
    )
    lent_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp when the item was lent.",
    )
    due_date: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
        description="Optional due date for item return.",
    )
    returned_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
        description="Timestamp when the item was returned.",
    )
    notes: str | None = Field(
        default=None,
        max_length=1000,
        description="Optional notes about the loan.",
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
    item: Item = Relationship(
        back_populates="lending_records",
        sa_relationship_kwargs={"lazy": "selectin"},
    )


class ProviderSubscription(SQLModel, table=True):
    """Household streaming provider configuration (e.g. Netflix, PS Plus)."""

    __tablename__ = "provider_subscriptions"
    __table_args__ = (Index("ix_provider_subscriptions_household_id_name", "household_id", "provider_name"),)

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the provider subscription.",
    )
    household_id: uuid.UUID = Field(
        nullable=False,
        index=True,
        description="Household UUID enforcing multi-tenant isolation.",
    )
    provider_name: str = Field(
        min_length=1,
        max_length=100,
        description="Name of provider (e.g., 'Netflix', 'Amazon Prime', 'PS Plus').",
    )
    provider_type: str = Field(
        default="STREAMING",
        max_length=50,
        description="Provider type (e.g., 'STREAMING', 'GAMING_PASS', 'BOOK_PASS').",
    )
    is_active: bool = Field(
        default=True,
        nullable=False,
        description="Flag indicating whether this household subscription is currently active.",
    )
    icon_url: str | None = Field(
        default=None,
        max_length=1024,
        description="Optional icon/logo URL of provider.",
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
    items: list[Item] = Relationship(
        back_populates="provider",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
