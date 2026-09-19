import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from backend_shared.household.testing import make_test_token, mcp_household_context
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.plans.models import Plan, PlanType
from src.features.pots.models import OverflowTarget, Pot
from src.features.transactions.models import Transaction, TransactionType
from src.main import app
from src.mcp.tools import (
    analyze_spending_gap,
    calculate_sinking_gap,
    get_pot_balances,
    suggest_budget_allocation,
)


@pytest.fixture(autouse=True)
def override_mcp_session(db_session: AsyncSession):
    """Patch async_session_factory in mcp.tools to use the test db_session."""

    class TestSessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("src.mcp.tools.async_session_factory", side_effect=TestSessionContext):
        yield


@pytest.mark.asyncio
async def test_get_pot_balances(db_session: AsyncSession):
    """Test get_pot_balances MCP tool output."""
    household_id = uuid.uuid4()
    pot1 = Pot(
        household_id=household_id,
        name="Emergency Fund",
        priority=1,
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("400.00"),
        overflow_target=OverflowTarget.CASCADE,
    )
    pot2 = Pot(
        household_id=household_id,
        name="Vacation",
        priority=2,
        target_amount=Decimal("500.00"),
        current_amount=Decimal("100.00"),
        overflow_target=OverflowTarget.UNASSIGNED,
    )
    db_session.add(pot1)
    db_session.add(pot2)
    await db_session.commit()

    with mcp_household_context(household_id=household_id):
        result = await get_pot_balances()
    assert "Emergency Fund" in result
    assert "Vacation" in result
    assert "400.00 / 1000.00" in result
    assert "100.00 / 500.00" in result


@pytest.mark.asyncio
async def test_suggest_budget_allocation(db_session: AsyncSession):
    """Test suggest_budget_allocation MCP tool calculation."""
    household_id = uuid.uuid4()
    pot1 = Pot(
        household_id=household_id,
        name="Bills",
        priority=1,
        target_amount=Decimal("200.00"),
        current_amount=Decimal("50.00"),
        overflow_target=OverflowTarget.CASCADE,
    )
    db_session.add(pot1)
    await db_session.commit()

    with mcp_household_context(household_id=household_id):
        result = await suggest_budget_allocation(income=300.0)
    assert "Suggested Budget Allocation" in result
    assert "Bills" in result
    assert "Allocated 150.00" in result
    assert "Unassigned Buffer: 150.00" in result


@pytest.mark.asyncio
async def test_analyze_spending_gap(db_session: AsyncSession):
    """Test analyze_spending_gap MCP tool calculation."""
    household_id = uuid.uuid4()
    plan = Plan(
        household_id=household_id,
        name="Monthly Core Budget",
        plan_type=PlanType.MONTHLY,
        total_budget=Decimal("500.00"),
    )
    db_session.add(plan)
    await db_session.commit()

    tx = Transaction(
        household_id=household_id,
        description="Supermarket",
        amount=Decimal("150.00"),
        transaction_type=TransactionType.EXPENSE,
        transaction_date=date(2025, 3, 15),
    )
    db_session.add(tx)
    await db_session.commit()

    with mcp_household_context(household_id=household_id):
        result = await analyze_spending_gap(month="2025-03")
    assert "Spending Gap Analysis for 2025-03" in result
    assert "Total Budgeted Plans: 500.00" in result
    assert "Total Actual Expenses: 150.00" in result
    assert "UNDER BUDGET" in result


@pytest.mark.asyncio
async def test_calculate_sinking_gap(db_session: AsyncSession):
    """Test calculate_sinking_gap MCP tool calculation."""
    household_id = uuid.uuid4()
    pot = Pot(
        household_id=household_id,
        name="Car Repair",
        priority=1,
        target_amount=Decimal("1200.00"),
        current_amount=Decimal("200.00"),
        monthly_contribution=Decimal("50.00"),
        target_date=date(2025, 12, 31),
        overflow_target=OverflowTarget.CASCADE,
    )
    db_session.add(pot)
    await db_session.commit()

    with mcp_household_context(household_id=household_id):
        result = await calculate_sinking_gap(pot_id=pot.id)
    assert "Sinking Fund Analysis for Pot 'Car Repair'" in result
    assert "Target Amount: 1200.00" in result
    assert "Current Amount: 200.00" in result


@pytest.mark.asyncio
async def test_mcp_health_endpoint():
    """Test MCP endpoint availability on FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        res = await client.get("/healthz")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_mcp_tools_only_see_the_middleware_household(db_session: AsyncSession):
    """Tools take the household from the MCP context, so another household's pots are invisible."""
    own_household = uuid.uuid4()
    other_household = uuid.uuid4()
    other_pot = Pot(
        household_id=other_household,
        name="Someone Else's Pot",
        priority=1,
        target_amount=Decimal("100.00"),
        current_amount=Decimal("10.00"),
        overflow_target=OverflowTarget.CASCADE,
    )
    db_session.add(other_pot)
    await db_session.commit()

    with mcp_household_context(household_id=own_household):
        balances = await get_pot_balances()
        sinking = await calculate_sinking_gap(pot_id=other_pot.id)

    assert "Someone Else's Pot" not in balances
    assert f"No active pots found for household {own_household}" in balances
    assert "Error calculating sinking fund gap" in sinking


@pytest.mark.asyncio
async def test_mcp_tools_require_household_context():
    """Without MCPAuthenticationMiddleware (no context) tools refuse to run instead of guessing a household."""
    with pytest.raises(RuntimeError, match="Household context not found"):
        await get_pot_balances()


@pytest.mark.asyncio
async def test_mcp_endpoint_requires_household_header():
    """The mounted MCP app is guarded by the shared household middleware."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        res = await client.post("/mcp", headers={"Authorization": f"Bearer {make_test_token('mcp-user')}"})
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "household_required"
