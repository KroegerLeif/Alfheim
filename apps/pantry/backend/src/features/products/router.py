import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import (
    UserHomeContext,
    get_current_user_and_home,
)
from src.features.products import (
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProductNutritionRead,
    ProductNutritionUpdate,
    ProductService,
)
from src.features.products.clients.open_food_facts import OpenFoodFactsClient

router = APIRouter(prefix="/api/v1/products", tags=["products"])
off_client = OpenFoodFactsClient()


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new product blueprint."""
    return await ProductService.create_product(
        session=session,
        payload=payload,
        home_id=context.home_id,
        is_global=False,
    )


@router.get("", response_model=list[ProductRead])
async def list_products(
    name: Optional[str] = None,
    barcode: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List and search all products (global + personal) visible to the home space.

    Highly performant listing: does not load the nutrition table.
    """
    return await ProductService.list_products(
        session=session,
        home_id=context.home_id,
        name=name,
        barcode=barcode,
        category_id=category_id,
        limit=limit,
        offset=offset,
    )


@router.get("/barcode/{barcode}", response_model=ProductRead)
async def get_product_by_barcode(
    barcode: str,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve or auto-ingest a product blueprint using its barcode.

    Checks local DB first (cache hit), falling back to Open Food Facts (cache miss).
    """
    product = await ProductService.get_or_create_by_barcode(
        session=session,
        barcode=barcode,
        home_id=context.home_id,
        off_client=off_client,
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode '{barcode}' could not be found or ingested.",
        )
    return product


@router.get("/{id}", response_model=ProductRead)
async def get_product(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve details of a specific product by ID."""
    product = await ProductService.get_product(
        session=session,
        product_id=id,
        home_id=context.home_id,
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )
    return product


@router.patch("/{id}", response_model=ProductRead)
async def update_product(
    id: uuid.UUID,
    payload: ProductUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Partially update an existing product blueprint.

    Global catalog templates cannot be modified.
    """
    product = await ProductService.update_product(
        session=session,
        product_id=id,
        home_id=context.home_id,
        payload=payload,
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )
    return product


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete a custom product blueprint.

    Global catalog templates cannot be deleted.
    """
    deleted = await ProductService.delete_product(
        session=session,
        product_id=id,
        home_id=context.home_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )


@router.get("/{id}/nutrition", response_model=ProductNutritionRead)
async def get_product_nutrition(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Fetch nutritional details of a product on-demand."""
    nutrition = await ProductService.get_product_nutrition(
        session=session,
        product_id=id,
        home_id=context.home_id,
    )
    if not nutrition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nutrition details not found for this product.",
        )
    return nutrition


@router.patch("/{id}/nutrition", response_model=ProductNutritionRead)
async def update_product_nutrition(
    id: uuid.UUID,
    payload: ProductNutritionUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Update or add nutritional details of a custom product blueprint.

    Global catalog templates cannot be modified.
    """
    nutrition = await ProductService.update_product_nutrition(
        session=session,
        product_id=id,
        home_id=context.home_id,
        payload=payload,
    )
    if not nutrition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )
    return nutrition
