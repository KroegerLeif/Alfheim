import inspect
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from backend_shared.household.testing import mcp_household_context
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.products.mcp_tools import (
    create_product,
    delete_product,
    get_product,
    get_product_by_barcode,
    get_product_nutrition,
    list_products,
    update_product,
    update_product_nutrition,
)
from src.features.products.models import BaseUnit
from src.features.products.schemas import ProductCreate, ProductNutritionCreate

TEST_HOUSEHOLD_A = uuid.UUID("00000000-0000-0000-0000-00000000000a")
TEST_HOUSEHOLD_B = uuid.UUID("00000000-0000-0000-0000-00000000000b")

ALL_TOOLS = [
    create_product,
    delete_product,
    get_product,
    get_product_by_barcode,
    get_product_nutrition,
    list_products,
    update_product,
    update_product_nutrition,
]


@pytest.fixture(autouse=True)
def override_mcp_session(db_session: AsyncSession):
    """Patch async_session_factory in mcp_tools to use the test db_session."""

    class TestSessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("src.features.products.mcp_tools.async_session_factory", side_effect=TestSessionContext):
        yield


@pytest.fixture(autouse=True)
async def seed_products(db_session: AsyncSession):
    """Seed global products dynamically for MCP product tool tests."""
    from src.features.products.seeder import seed_default_products

    await seed_default_products(db_session)
    await db_session.commit()


def test_mcp_product_tools_take_no_household_argument():
    """The LLM can never choose the household: no product tool exposes a household/user argument."""
    for tool in ALL_TOOLS:
        params = inspect.signature(tool).parameters
        assert "household_id" not in params, tool.__name__
        assert "home_id" not in params, tool.__name__
        assert "user_id" not in params, tool.__name__


async def test_mcp_tools_require_household_context():
    """Without an authenticated MCP household context the tools refuse to run."""
    res = await list_products()
    assert "Household context not found" in res


def _extract_id(list_res: str) -> str:
    id_start = list_res.find("(ID: ") + 5
    return list_res[id_start : list_res.find(")", id_start)]


async def test_mcp_create_and_get_product(db_session: AsyncSession):
    """Test creating a local product via MCP tool and retrieving its metadata."""
    with mcp_household_context(household_id=TEST_HOUSEHOLD_A):
        create_res = await create_product(
            name="MCP Honey",
            base_unit="g",
            brand="Apiary",
            calories=300.0,
            sugars=80.0,
        )
        assert "Success: Created local product blueprint 'MCP Honey'" in create_res

        list_res = await list_products(name="MCP Honey")
        assert "MCP Honey" in list_res
        assert "by Apiary" in list_res
        prod_id = _extract_id(list_res)

        get_res = await get_product(prod_id)
        assert "Product: MCP Honey" in get_res
        assert f"ID: {prod_id}" in get_res
        assert "Base Unit: g" in get_res

        nut_res = await get_product_nutrition(prod_id)
        assert "Nutritional profile per 100g/ml:" in nut_res
        assert "Calories: 300.0 kcal" in nut_res

    # The product was stored under the context household, not a derived/phantom one
    from src.features.products.models import Product

    stored = await db_session.get(Product, uuid.UUID(prod_id))
    assert stored is not None
    assert stored.home_id == TEST_HOUSEHOLD_A

    # Household isolation: a session authorized for Household B cannot see Household A's local product
    with mcp_household_context(household_id=TEST_HOUSEHOLD_B):
        get_res_b = await get_product(prod_id)
        assert f"Product with ID {prod_id} not found or not authorized." in get_res_b
        assert "MCP Honey" not in await list_products(name="MCP Honey")


async def test_mcp_create_product_invalid_id_format():
    """Test error handling when invalid parameters or UUIDs are supplied."""
    with mcp_household_context(household_id=TEST_HOUSEHOLD_A):
        get_res = await get_product("not-a-valid-uuid")
        assert "Error: Invalid ID format" in get_res

        update_res = await update_product("invalid-uuid", name="New Name")
        assert "Error: Update failed" in update_res or "Invalid ID format" in update_res


async def test_mcp_update_and_delete_product(db_session: AsyncSession):
    """Test updating and deleting a custom product via MCP tools."""
    with mcp_household_context(household_id=TEST_HOUSEHOLD_A):
        await create_product(name="MCP Bread", base_unit="g")
        prod_id = _extract_id(await list_products(name="MCP Bread"))

        update_res = await update_product(prod_id, name="MCP Sourdough Bread")
        assert f"Success: Updated product blueprint {prod_id}" in update_res

        nut_update = await update_product_nutrition(prod_id, calories=220.0, protein=8.0)
        assert f"Success: Updated nutrition profile for product {prod_id}" in nut_update

    # Delete product from Household B fails
    with mcp_household_context(household_id=TEST_HOUSEHOLD_B):
        del_res_b = await delete_product(prod_id)
        assert f"Product with ID {prod_id} not found or not authorized." in del_res_b

    # Delete product from Household A succeeds
    with mcp_household_context(household_id=TEST_HOUSEHOLD_A):
        del_res = await delete_product(prod_id)
        assert f"Success: Deleted product blueprint {prod_id}" in del_res


@patch("src.features.products.mcp_tools.off_client.get_by_barcode")
async def test_mcp_get_product_by_barcode(mock_get: AsyncMock, db_session: AsyncSession):
    """Test retrieving product by barcode via MCP tool."""
    with mcp_household_context(household_id=TEST_HOUSEHOLD_A):
        res_cached = await get_product_by_barcode("7394376615967")
        assert "Ingested Product Details:" in res_cached
        assert "Oatly Barista Edition" in res_cached

        mock_get.return_value = ProductCreate(
            name="MCP Cola",
            brand="SodaCo",
            barcode="111222333444",
            base_unit=BaseUnit.ML,
            nutrition=ProductNutritionCreate(calories=40.0),
        )

        res_ingested = await get_product_by_barcode("111222333444")
        assert "Ingested Product Details:" in res_ingested
        assert "MCP Cola" in res_ingested
