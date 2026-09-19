"""MCP tools take the household (and acting user) exclusively from the authenticated MCP context."""

import inspect
import uuid
from contextlib import ExitStack
from unittest.mock import patch

import pytest
from backend_shared.household.testing import mcp_household_context
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.categories import mcp_tools as category_tools
from src.features.categories.models import Category
from src.features.inventory import mcp_tools as inventory_tools
from src.features.locations import mcp_tools as location_tools
from src.features.locations.models import Location
from src.features.products.models import Product

HOUSEHOLD_A = uuid.UUID("00000000-0000-0000-0000-0000000000a1")
HOUSEHOLD_B = uuid.UUID("00000000-0000-0000-0000-0000000000b1")

TOOL_MODULES = [category_tools, inventory_tools, location_tools]


@pytest.fixture(autouse=True)
def mcp_sessions(db_session: AsyncSession):
    """Route every MCP module's session factory to the transactional test session."""

    class TestSessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return None

    with ExitStack() as stack:
        for module in TOOL_MODULES:
            stack.enter_context(patch.object(module, "async_session_factory", side_effect=TestSessionContext))
        yield


def test_no_tool_accepts_household_or_user_arguments():
    for module in TOOL_MODULES:
        for name, fn in inspect.getmembers(module, inspect.iscoroutinefunction):
            if fn.__module__ != module.__name__:
                continue
            params = inspect.signature(fn).parameters
            assert not {"household_id", "home_id", "user_id"} & set(params), f"{module.__name__}.{name}"


async def test_tools_fail_without_household_context():
    assert "Household context not found" in await location_tools.list_locations()
    assert "Household context not found" in await category_tools.list_categories()
    assert "Household context not found" in await inventory_tools.get_current_inventory()


async def test_location_and_category_created_in_context_household(db_session: AsyncSession):
    with mcp_household_context(household_id=HOUSEHOLD_A, sub="mcp-user") as ctx:
        loc_res = await location_tools.create_location(name="MCP Shelf")
        cat_res = await category_tools.create_category(name="MCP Snacks")
    assert "Success" in loc_res
    assert "Success" in cat_res

    loc = (await db_session.exec(select(Location).where(Location.name == "MCP Shelf"))).one()
    assert loc.home_id == HOUSEHOLD_A
    assert loc.owner_id == ctx.user_id
    cat = (await db_session.exec(select(Category).where(Category.name == "MCP Snacks"))).one()
    assert cat.home_id == HOUSEHOLD_A
    assert cat.owner_id == ctx.user_id

    # Another household's session cannot see them
    with mcp_household_context(household_id=HOUSEHOLD_B):
        assert "MCP Shelf" not in await location_tools.list_locations()
        assert "not found" in await location_tools.get_location(str(loc.id))
        assert "MCP Snacks" not in await category_tools.list_categories()


async def test_inventory_movement_recorded_in_context_household(db_session: AsyncSession):
    """Regression: inventory tools used to write to uuid5(NAMESPACE_DNS, household_id), a phantom household."""
    loc = Location(name="MCP Fridge", owner_id=uuid.uuid4(), home_id=HOUSEHOLD_A)
    prod = Product(name="MCP Milk", base_unit="ml", home_id=HOUSEHOLD_A)
    db_session.add(loc)
    db_session.add(prod)
    await db_session.commit()

    with mcp_household_context(household_id=HOUSEHOLD_A):
        res = await inventory_tools.record_inventory_movement(
            product_id=str(prod.id),
            location_id=str(loc.id),
            transaction_type="in",
            quantity_input=500,
            unit_input="ml",
        )
        assert "Success" in res, res
        state = await inventory_tools.get_current_inventory()
        assert "MCP Milk" in state

    with mcp_household_context(household_id=HOUSEHOLD_B):
        assert "MCP Milk" not in await inventory_tools.get_current_inventory()
