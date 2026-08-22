from src.core.dependencies import MOCK_HOME_ID
from src.features.products.clients.open_food_facts import OpenFoodFactsClient
from src.features.products.service import ProductService
from src.mcp.server import mcp

off_client = OpenFoodFactsClient()


@mcp.tool()
async def list_products(
    name: str | None = None,
    barcode: str | None = None,
    category_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> str:
    """Search and list product blueprints visible to the home space."""
    try:
        from src.features.products.mcp_tools import async_session_factory

        async with async_session_factory() as session:
            products = await ProductService.list_products(
                session=session,
                home_id=MOCK_HOME_ID,
                name=name,
                barcode=barcode,
                category_id=category_id,
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
    """Retrieve detailed metadata for a specific product by ID."""
    try:
        from src.features.products.mcp_tools import async_session_factory

        async with async_session_factory() as session:
            prod = await ProductService.get_product(
                session=session,
                product_id=product_id,
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
    """Retrieve a product by barcode (auto-ingests from Open Food Facts on local miss)."""
    try:
        from src.features.products.mcp_tools import async_session_factory, off_client

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
    """Create a new product blueprint (automatically promoted to global if barcode is present)."""
    try:
        from src.features.products.mcp_tools import async_session_factory

        async with async_session_factory() as session:
            prod = await ProductService.create_product(
                session=session,
                home_id=MOCK_HOME_ID,
                name=name,
                base_unit=base_unit,
                brand=brand,
                barcode=barcode,
                category_id=category_id,
                image_url=image_url,
                minimum_stock=minimum_stock,
                calories=calories,
                fat=fat,
                saturated_fat=saturated_fat,
                carbohydrates=carbohydrates,
                sugars=sugars,
                protein=protein,
                salt=salt,
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
    """Update details of a custom product blueprint."""
    try:
        from src.features.products.mcp_tools import async_session_factory

        async with async_session_factory() as session:
            prod = await ProductService.update_product(
                session=session,
                product_id=product_id,
                home_id=MOCK_HOME_ID,
                name=name,
                brand=brand,
                barcode=barcode,
                category_id=category_id,
                image_url=image_url,
                base_unit=base_unit,
                minimum_stock=minimum_stock,
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
    """Delete a custom product blueprint."""
    try:
        from src.features.products.mcp_tools import async_session_factory

        async with async_session_factory() as session:
            success = await ProductService.delete_product(
                session=session,
                product_id=product_id,
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
    """Fetch nutritional details for a product by ID on-demand."""
    try:
        from src.features.products.mcp_tools import async_session_factory

        async with async_session_factory() as session:
            nutrition = await ProductService.get_product_nutrition(
                session=session,
                product_id=product_id,
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
    """Update or add nutritional details to a custom product blueprint."""
    try:
        from src.features.products.mcp_tools import async_session_factory

        async with async_session_factory() as session:
            nutrition = await ProductService.update_product_nutrition(
                session=session,
                product_id=product_id,
                home_id=MOCK_HOME_ID,
                calories=calories,
                fat=fat,
                saturated_fat=saturated_fat,
                carbohydrates=carbohydrates,
                sugars=sugars,
                protein=protein,
                salt=salt,
            )

            if not nutrition:
                return f"Product with ID {product_id} not found or not authorized."

            return f"Success: Updated nutrition profile for product {product_id}."

    except ValueError as e:
        return f"Error: Update failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
