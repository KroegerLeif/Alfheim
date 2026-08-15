import uuid

from src.core.database import async_session_factory
from src.core.dependencies import MOCK_HOME_ID
from src.features.products.clients.open_food_facts import OpenFoodFactsClient
from src.features.products.schemas import (
    ProductCreate,
    ProductNutritionCreate,
    ProductNutritionUpdate,
    ProductUpdate,
)
from src.features.products.service import ProductService
from src.mcp.server import mcp

# Initialize the Open Food Facts client for external barcode queries
off_client = OpenFoodFactsClient()


@mcp.tool()
async def list_products(
    name: str | None = None,
    barcode: str | None = None,
    category_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> str:
    """Search and list product blueprints visible to the home space.

    Parameters:
    - name: Optional search term matching part of the product name (case-insensitive).
    - barcode: Optional exact barcode filter.
    - category_id: Optional UUID string of category to filter products.
    - limit: Maximum number of records to return (default 100).
    - offset: Number of records to skip (default 0).
    """
    try:
        cat_uuid = uuid.UUID(category_id) if category_id else None
        async with async_session_factory() as session:
            products = await ProductService.list_products(
                session=session,
                home_id=MOCK_HOME_ID,
                name=name,
                barcode=barcode,
                category_id=cat_uuid,
                limit=limit,
                offset=offset,
            )

            if not products:
                return "No product blueprints found."

            lines = []
            for prod in products:
                global_tag = " [Global]" if prod.is_global else ""
                brand_str = f" by {prod.brand}" if prod.brand else ""
                barcode_str = f" [Barcode: {prod.barcode}]" if prod.barcode else ""
                category_str = f" [Category ID: {prod.category_id}]" if prod.category_id else ""
                lines.append(
                    f"- {prod.name}{brand_str} (ID: {prod.id}){global_tag}"
                    f" (Unit: {prod.base_unit}){barcode_str}{category_str}"
                )
            return "\n".join(lines)

    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to list products: {str(e)}"


@mcp.tool()
async def get_product(product_id: str) -> str:
    """Retrieve detailed metadata for a specific product by ID.

    Parameters:
    - product_id: UUID string of the product blueprint.
    """
    try:
        prod_uuid = uuid.UUID(product_id)
        async with async_session_factory() as session:
            prod = await ProductService.get_product(
                session=session,
                product_id=prod_uuid,
                home_id=MOCK_HOME_ID,
            )

            if not prod:
                return f"Product with ID {product_id} not found or not authorized."

            global_tag = " [Global]" if prod.is_global else ""
            brand_str = f"\nBrand: {prod.brand}" if prod.brand else ""
            barcode_str = f"\nBarcode: {prod.barcode}" if prod.barcode else ""
            category_str = f"\nCategory ID: {prod.category_id}" if prod.category_id else ""
            image_str = f"\nImage URL: {prod.image_url}" if prod.image_url else ""
            return (
                f"Product: {prod.name}{global_tag}\n"
                f"ID: {prod.id}{brand_str}{barcode_str}{category_str}\n"
                f"Base Unit: {prod.base_unit}\n"
                f"Minimum Stock Threshold: {prod.minimum_stock} {prod.base_unit}{image_str}\n"
                f"Created: {prod.created_at} | Updated: {prod.updated_at}"
            )

    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to retrieve product: {str(e)}"


@mcp.tool()
async def get_product_by_barcode(barcode: str) -> str:
    """Retrieve a product by barcode (auto-ingests from Open Food Facts on local miss).

    Parameters:
    - barcode: The EAN/UPC product barcode string (e.g. '7394376615967').
    """
    try:
        async with async_session_factory() as session:
            prod = await ProductService.get_or_create_by_barcode(
                session=session,
                barcode=barcode,
                home_id=MOCK_HOME_ID,
                off_client=off_client,
            )

            if not prod:
                return f"Product with barcode '{barcode}' could not be found locally or ingested externally."

            global_tag = " [Global]" if prod.is_global else ""
            brand_str = f"\nBrand: {prod.brand}" if prod.brand else ""
            category_str = f"\nCategory ID: {prod.category_id}" if prod.category_id else ""
            return (
                f"Ingested Product Details:\n"
                f"Product: {prod.name}{global_tag}\n"
                f"ID: {prod.id}{brand_str}\n"
                f"Barcode: {prod.barcode}{category_str}\n"
                f"Base Unit: {prod.base_unit} | Min Stock: {prod.minimum_stock}"
            )

    except Exception as e:
        return f"Error: Barcode lookup failed: {str(e)}"


@mcp.tool()
async def create_product(
    name: str,
    base_unit: str,
    brand: str | None = None,
    barcode: str | None = None,
    category_id: str | None = None,
    image_url: str | None = None,
    minimum_stock: float = 0.0,
    calories: float | None = None,
    fat: float | None = None,
    saturated_fat: float | None = None,
    carbohydrates: float | None = None,
    sugars: float | None = None,
    protein: float | None = None,
    salt: float | None = None,
) -> str:
    """Create a new product blueprint (automatically promoted to global if barcode is present).

    Parameters:
    - name: Name of the product commodity (e.g. 'Oat Milk Barista').
    - base_unit: Allowed units: 'g', 'ml', 'piece', 'm'.
    - brand: Brand name.
    - barcode: Globally unique EAN/UPC barcode (triggers global promotion).
    - category_id: UUID of category to associate.
    - image_url: Product picture web address.
    - minimum_stock: Lower stock limit warning threshold.
    - calories: Calories per 100g/ml.
    - fat: Fat grams per 100g/ml.
    - saturated_fat: Saturated fat grams per 100g/ml.
    - carbohydrates: Carbohydrates grams per 100g/ml.
    - sugars: Sugars grams per 100g/ml.
    - protein: Protein grams per 100g/ml.
    - salt: Salt grams per 100g/ml.
    """
    try:
        nutrition_payload = None
        if any(v is not None for v in [calories, fat, saturated_fat, carbohydrates, sugars, protein, salt]):
            nutrition_payload = ProductNutritionCreate(
                calories=calories,
                fat=fat,
                saturated_fat=saturated_fat,
                carbohydrates=carbohydrates,
                sugars=sugars,
                protein=protein,
                salt=salt,
            )

        payload = ProductCreate(
            name=name,
            base_unit=base_unit,
            brand=brand,
            barcode=barcode,
            category_id=uuid.UUID(category_id) if category_id else None,
            image_url=image_url,
            minimum_stock=minimum_stock,
            nutrition=nutrition_payload,
        )

        async with async_session_factory() as session:
            prod = await ProductService.create_product(
                session=session,
                payload=payload,
                home_id=MOCK_HOME_ID,
                is_global=False,  # Barcode validation promotes automatically inside Service
            )
            global_status = "global" if prod.is_global else "local"
            return f"Success: Created {global_status} product blueprint '{prod.name}' with ID {prod.id}."

    except ValueError as e:
        return f"Error: Failed to create product: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def update_product(
    product_id: str,
    name: str | None = None,
    brand: str | None = None,
    barcode: str | None = None,
    category_id: str | None = None,
    image_url: str | None = None,
    base_unit: str | None = None,
    minimum_stock: float | None = None,
) -> str:
    """Update details of a custom product blueprint (Global catalog items cannot be updated).

    Parameters:
    - product_id: UUID string of the product to update.
    - name: Optional new name.
    - brand: Optional new brand.
    - barcode: Optional barcode (will trigger promotion to global if updated with valid code).
    - category_id: Optional UUID string of category.
    - image_url: Optional picture URL.
    - base_unit: Optional new base unit ('g', 'ml', 'piece', 'm').
    - minimum_stock: Optional new minimum stock limit.
    """
    try:
        prod_uuid = uuid.UUID(product_id)
        payload = ProductUpdate(
            name=name,
            brand=brand,
            barcode=barcode,
            category_id=uuid.UUID(category_id) if category_id else None,
            image_url=image_url,
            base_unit=base_unit,
            minimum_stock=minimum_stock,
        )

        async with async_session_factory() as session:
            prod = await ProductService.update_product(
                session=session,
                product_id=prod_uuid,
                home_id=MOCK_HOME_ID,
                payload=payload,
            )

            if not prod:
                return f"Product with ID {product_id} not found or not authorized."

            global_tag = " (now promoted to Global)" if prod.is_global else ""
            return f"Success: Updated product blueprint {prod.id} (Name: '{prod.name}'){global_tag}."

    except ValueError as e:
        return f"Error: Update failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def delete_product(product_id: str) -> str:
    """Delete a custom product blueprint.

    Parameters:
    - product_id: UUID string of the custom product to delete.
    """
    try:
        prod_uuid = uuid.UUID(product_id)
        async with async_session_factory() as session:
            success = await ProductService.delete_product(
                session=session,
                product_id=prod_uuid,
                home_id=MOCK_HOME_ID,
            )

            if not success:
                return f"Product with ID {product_id} not found or not authorized."

            return f"Success: Deleted product blueprint {product_id}."

    except ValueError as e:
        return f"Error: Deletion failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def get_product_nutrition(product_id: str) -> str:
    """Fetch nutritional details for a product by ID on-demand.

    Parameters:
    - product_id: UUID string of the product blueprint.
    """
    try:
        prod_uuid = uuid.UUID(product_id)
        async with async_session_factory() as session:
            nutrition = await ProductService.get_product_nutrition(
                session=session,
                product_id=prod_uuid,
                home_id=MOCK_HOME_ID,
            )

            if not nutrition:
                return f"No nutritional details found for product ID {product_id}."

            return (
                f"Nutritional profile per 100g/ml:\n"
                f"- Calories: {nutrition.calories} kcal\n"
                f"- Fat: {nutrition.fat} g (Saturated: {nutrition.saturated_fat} g)\n"
                f"- Carbohydrates: {nutrition.carbohydrates} g (Sugars: {nutrition.sugars} g)\n"
                f"- Protein: {nutrition.protein} g\n"
                f"- Salt: {nutrition.salt} g"
            )

    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to fetch nutritional data: {str(e)}"


@mcp.tool()
async def update_product_nutrition(
    product_id: str,
    calories: float | None = None,
    fat: float | None = None,
    saturated_fat: float | None = None,
    carbohydrates: float | None = None,
    sugars: float | None = None,
    protein: float | None = None,
    salt: float | None = None,
) -> str:
    """Update or add nutritional details to a custom product blueprint (Global items cannot be updated).

    Parameters:
    - product_id: UUID string of the target custom product.
    - calories: Calories per 100g/ml.
    - fat: Fat grams per 100g/ml.
    - saturated_fat: Saturated fat grams per 100g/ml.
    - carbohydrates: Carbohydrates grams per 100g/ml.
    - sugars: Sugars grams per 100g/ml.
    - protein: Protein grams per 100g/ml.
    - salt: Salt grams per 100g/ml.
    """
    try:
        prod_uuid = uuid.UUID(product_id)
        payload = ProductNutritionUpdate(
            calories=calories,
            fat=fat,
            saturated_fat=saturated_fat,
            carbohydrates=carbohydrates,
            sugars=sugars,
            protein=protein,
            salt=salt,
        )

        async with async_session_factory() as session:
            nutrition = await ProductService.update_product_nutrition(
                session=session,
                product_id=prod_uuid,
                home_id=MOCK_HOME_ID,
                payload=payload,
            )

            if not nutrition:
                return f"Product with ID {product_id} not found or not authorized."

            return f"Success: Updated nutrition profile for product {product_id}."

    except ValueError as e:
        return f"Error: Update failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
