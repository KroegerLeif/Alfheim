import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from src.features.products.models import BaseUnit


# -------------------------------------------------------------
# Product Nutrition Schemas
# -------------------------------------------------------------

class ProductNutritionBase(SQLModel):
    """Base schema containing nutritional fields shared across lifecycle schemas."""

    calories: Optional[float] = Field(
        default=None, ge=0, description="Calories per 100g/ml."
    )
    fat: Optional[float] = Field(
        default=None, ge=0, description="Fat in grams per 100g/ml."
    )
    saturated_fat: Optional[float] = Field(
        default=None,
        ge=0,
        description="Saturated fat in grams per 100g/ml.",
    )
    carbohydrates: Optional[float] = Field(
        default=None,
        ge=0,
        description="Carbohydrates in grams per 100g/ml.",
    )
    sugars: Optional[float] = Field(
        default=None, ge=0, description="Sugars in grams per 100g/ml."
    )
    protein: Optional[float] = Field(
        default=None, ge=0, description="Protein in grams per 100g/ml."
    )
    salt: Optional[float] = Field(
        default=None, ge=0, description="Salt in grams per 100g/ml."
    )


class ProductNutritionCreate(ProductNutritionBase):
    """Schema for creating a ProductNutrition record."""

    pass


class ProductNutritionUpdate(SQLModel):
    """Schema for partially updating a ProductNutrition record."""

    calories: Optional[float] = Field(default=None, ge=0)
    fat: Optional[float] = Field(default=None, ge=0)
    saturated_fat: Optional[float] = Field(default=None, ge=0)
    carbohydrates: Optional[float] = Field(default=None, ge=0)
    sugars: Optional[float] = Field(default=None, ge=0)
    protein: Optional[float] = Field(default=None, ge=0)
    salt: Optional[float] = Field(default=None, ge=0)


class ProductNutritionRead(ProductNutritionBase):
    """Schema for reading ProductNutrition data in API responses."""

    product_id: uuid.UUID


# -------------------------------------------------------------
# Product Schemas
# -------------------------------------------------------------

class ProductBase(SQLModel):
    """Base schema containing product fields shared across lifecycle schemas."""

    name: str = Field(
        min_length=1, max_length=255, description="Name of the product."
    )
    brand: Optional[str] = Field(
        default=None, max_length=255, description="Brand name of the product."
    )
    barcode: Optional[str] = Field(
        default=None, description="Globally unique product barcode (EAN/UPC)."
    )
    image_url: Optional[str] = Field(
        default=None, max_length=2048, description="URL of the product image."
    )
    base_unit: BaseUnit = Field(
        description="Base unit of measurement (g, ml, piece, m)."
    )
    minimum_stock: float = Field(
        default=0.0,
        ge=0.0,
        description="Minimum stock threshold quantity required for this product in the home.",
    )


class ProductCreate(ProductBase):
    """Schema for creating a new product.

    Allows nested nutrition payload during creation.
    """

    nutrition: Optional[ProductNutritionCreate] = Field(
        default=None,
        description="Optional nutrition profile to create alongside the product.",
    )


class ProductUpdate(SQLModel):
    """Schema for partially updating an existing product (PATCH)."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=255)
    barcode: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    base_unit: Optional[BaseUnit] = Field(default=None)
    minimum_stock: Optional[float] = Field(default=None, ge=0.0)


class ProductRead(ProductBase):
    """Schema for returning product details in API list and detail responses.

    Excludes the heavy nutrition fields by default to optimize list queries.
    """

    id: uuid.UUID
    is_global: bool
    home_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
