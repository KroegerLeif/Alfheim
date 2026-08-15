import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel

from src.features.products.models import BaseUnit

# -------------------------------------------------------------
# Product Nutrition Schemas
# -------------------------------------------------------------


class ProductNutritionBase(SQLModel):
    """Base schema containing nutritional fields shared across lifecycle schemas."""

    calories: float | None = Field(default=None, ge=0, description="Calories per 100g/ml.")
    fat: float | None = Field(default=None, ge=0, description="Fat in grams per 100g/ml.")
    saturated_fat: float | None = Field(
        default=None,
        ge=0,
        description="Saturated fat in grams per 100g/ml.",
    )
    carbohydrates: float | None = Field(
        default=None,
        ge=0,
        description="Carbohydrates in grams per 100g/ml.",
    )
    sugars: float | None = Field(default=None, ge=0, description="Sugars in grams per 100g/ml.")
    protein: float | None = Field(default=None, ge=0, description="Protein in grams per 100g/ml.")
    salt: float | None = Field(default=None, ge=0, description="Salt in grams per 100g/ml.")


class ProductNutritionCreate(ProductNutritionBase):
    """Schema for creating a ProductNutrition record."""

    pass


class ProductNutritionUpdate(SQLModel):
    """Schema for partially updating a ProductNutrition record."""

    calories: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    saturated_fat: float | None = Field(default=None, ge=0)
    carbohydrates: float | None = Field(default=None, ge=0)
    sugars: float | None = Field(default=None, ge=0)
    protein: float | None = Field(default=None, ge=0)
    salt: float | None = Field(default=None, ge=0)


class ProductNutritionRead(ProductNutritionBase):
    """Schema for reading ProductNutrition data in API responses."""

    product_id: uuid.UUID


# -------------------------------------------------------------
# Product Schemas
# -------------------------------------------------------------


class ProductBase(SQLModel):
    """Base schema containing product fields shared across lifecycle schemas."""

    name: str = Field(min_length=1, max_length=255, description="Name of the product.")
    brand: str | None = Field(default=None, max_length=255, description="Brand name of the product.")
    barcode: str | None = Field(default=None, description="Globally unique product barcode (EAN/UPC).")
    image_url: str | None = Field(default=None, max_length=2048, description="URL of the product image.")
    base_unit: BaseUnit = Field(description="Base unit of measurement (g, ml, piece, m).")
    minimum_stock: float = Field(
        default=0.0,
        ge=0.0,
        description="Minimum stock threshold quantity required for this product in the home.",
    )
    category_id: uuid.UUID | None = Field(
        default=None,
        description="Optional reference to the product category.",
    )


class ProductCreate(ProductBase):
    """Schema for creating a new product.

    Allows nested nutrition payload during creation.
    """

    nutrition: ProductNutritionCreate | None = Field(
        default=None,
        description="Optional nutrition profile to create alongside the product.",
    )


class ProductUpdate(SQLModel):
    """Schema for partially updating an existing product (PATCH)."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=255)
    barcode: str | None = Field(default=None)
    image_url: str | None = Field(default=None, max_length=2048)
    base_unit: BaseUnit | None = Field(default=None)
    minimum_stock: float | None = Field(default=None, ge=0.0)
    category_id: uuid.UUID | None = Field(default=None)


class ProductRead(ProductBase):
    """Schema for returning product details in API list and detail responses.

    Excludes the heavy nutrition fields by default to optimize list queries.
    """

    id: uuid.UUID
    is_global: bool
    home_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
