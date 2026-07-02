import enum
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, DateTime, String
from sqlmodel import Field, SQLModel, Relationship, func


class BaseUnit(str, enum.Enum):
    """Supported base units of measurement for products."""

    G = "g"
    ML = "ml"
    PIECE = "piece"
    M = "m"


class Product(SQLModel, table=True):
    """Database model for the abstract product blueprint (Stammdaten)."""

    __tablename__ = "products"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the product blueprint.",
    )
    category_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="categories.id",
        nullable=True,
        index=True,
        description="Optional reference to the product category.",
    )
    name: str = Field(
        index=True,
        min_length=1,
        max_length=255,
        description="Name of the product.",
    )
    brand: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Brand of the product.",
    )
    barcode: Optional[str] = Field(
        default=None,
        unique=True,
        nullable=True,
        index=True,
        description="Globally unique barcode if present, otherwise null for local items.",
    )
    image_url: Optional[str] = Field(
        default=None,
        max_length=2048,
        description="Optional URL to a product image.",
    )
    base_unit: BaseUnit = Field(
        sa_column=Column(String, nullable=False),
        description="The base unit of measurement for this product.",
    )
    is_global: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="If True, this product is system-wide and visible to all homes.",
    )
    home_id: Optional[uuid.UUID] = Field(
        default=None,
        nullable=True,
        index=True,
        description="UUID of the home space this local product belongs to. Null for global products.",
    )
    minimum_stock: float = Field(
        default=0.0,
        nullable=False,
        description="Minimum stock threshold quantity required for this product in the home.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp when the product was created, in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
        description="Timestamp when the product was last updated, in UTC.",
    )

    # 1:1 relationship with Cascade deletion
    nutrition: Optional["ProductNutrition"] = Relationship(
        back_populates="product",
        sa_relationship_kwargs={
            "uselist": False,
            "cascade": "all, delete-orphan",
        },
    )


class ProductNutrition(SQLModel, table=True):
    """Database model for product nutritional profile.

    Uses a 1:1 relationship where product_id is both the Primary Key and Foreign Key.
    """

    __tablename__ = "product_nutrition"

    product_id: uuid.UUID = Field(
        primary_key=True,
        foreign_key="products.id",
        nullable=False,
        ondelete="CASCADE",
        description="Reference to the parent product entity.",
    )
    calories: Optional[float] = Field(
        default=None, nullable=True, description="Calories per 100g/ml."
    )
    fat: Optional[float] = Field(
        default=None, nullable=True, description="Fat in grams per 100g/ml."
    )
    saturated_fat: Optional[float] = Field(
        default=None,
        nullable=True,
        description="Saturated fat in grams per 100g/ml.",
    )
    carbohydrates: Optional[float] = Field(
        default=None,
        nullable=True,
        description="Carbohydrates in grams per 100g/ml.",
    )
    sugars: Optional[float] = Field(
        default=None,
        nullable=True,
        description="Sugars in grams per 100g/ml.",
    )
    protein: Optional[float] = Field(
        default=None,
        nullable=True,
        description="Protein in grams per 100g/ml.",
    )
    salt: Optional[float] = Field(
        default=None, nullable=True, description="Salt in grams per 100g/ml."
    )

    # Relationship back to Product
    product: Optional[Product] = Relationship(
        back_populates="nutrition",
        sa_relationship_kwargs={"uselist": False},
    )
