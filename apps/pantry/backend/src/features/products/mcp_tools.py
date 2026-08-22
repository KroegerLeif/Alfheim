from src.core.database import async_session_factory
from src.core.dependencies import MOCK_HOME_ID
from src.features.products.clients.open_food_facts import OpenFoodFactsClient
from src.features.products.mcp.product_mcp import (
    create_product,
    delete_product,
    get_product,
    get_product_by_barcode,
    get_product_nutrition,
    list_products,
    update_product,
    update_product_nutrition,
)

off_client = OpenFoodFactsClient()

__all__ = [
    "async_session_factory",
    "MOCK_HOME_ID",
    "off_client",
    "list_products",
    "get_product",
    "get_product_by_barcode",
    "create_product",
    "update_product",
    "delete_product",
    "get_product_nutrition",
    "update_product_nutrition",
]
