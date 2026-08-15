import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Index, text
from sqlmodel import Field, SQLModel, func


class CategoryBase(SQLModel):
    """Base schema containing fields shared across all Category schemas."""

    name: str = Field(
        index=True,
        min_length=1,
        max_length=100,
        description="Name of the product category.",
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Optional description/details of the category.",
    )


class CategoryCreate(CategoryBase):
    """Schema for creating a new Category."""

    pass


class CategoryUpdate(SQLModel):
    """Schema for partially updating an existing Category (PATCH)."""

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Updated name of the category.",
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Updated description of the category.",
    )


class CategoryRead(CategoryBase):
    """Schema for returning category details in API responses."""

    id: uuid.UUID
    is_global: bool
    owner_id: uuid.UUID | None
    home_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class Category(CategoryBase, table=True):
    """The database table model for categories."""

    __tablename__ = "categories"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the category.",
    )
    is_global: bool = Field(
        default=False,
        nullable=False,
        description="If True, this is a system-wide global category visible to all homes.",
    )
    owner_id: uuid.UUID | None = Field(
        default=None,
        nullable=True,
        description="UUID of the user who created the category. Null for system/global categories.",
    )
    home_id: uuid.UUID | None = Field(
        default=None,
        nullable=True,
        description="UUID of the home space this category belongs to. Null for system/global categories.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp of creation, stored in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
        description="Timestamp of last update, stored in UTC.",
    )


# Enforce uniqueness constraints at the database level
# 1. Global category names must be unique database-wide (where home_id is NULL)
Index(
    "uq_global_category_name",
    Category.name,
    unique=True,
    postgresql_where=text("home_id IS NULL"),
    sqlite_where=text("home_id IS NULL"),
)

# 2. Personal category names must be unique within a home space (where home_id is NOT NULL)
Index(
    "uq_personal_category_name",
    Category.home_id,
    Category.name,
    unique=True,
    postgresql_where=text("home_id IS NOT NULL"),
    sqlite_where=text("home_id IS NOT NULL"),
)
