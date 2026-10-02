import calendar
from datetime import date
from decimal import Decimal
from uuid import UUID

from backend_shared.mcp_middleware import get_mcp_household_context
from src.core.database import async_session_factory
from src.features.plans.service import PlanService
from src.features.pots.repository import PotRepository
from src.features.pots.service import PotService
from src.features.transactions.repository import TransactionRepository
from src.features.transactions.service import TransactionService
from src.mcp.server import mcp


def _household_id() -> UUID:
    """Household of the current MCP request, as confirmed by MCPAuthenticationMiddleware (never LLM-supplied)."""
    return get_mcp_household_context().household_id


def _month_bounds(month: str) -> tuple[date, date]:
    """Parse a 'YYYY-MM' string into its first and last calendar date (inclusive).

    Raises ValueError if `month` is not in the expected format.
    """
    year_str, month_str = month.split("-")
    year, month_num = int(year_str), int(month_str)
    if not 1 <= month_num <= 12:
        raise ValueError(f"month out of range: {month_num}")
    last_day = calendar.monthrange(year, month_num)[1]
    return date(year, month_num, 1), date(year, month_num, last_day)


@mcp.tool()
async def get_pot_balances() -> str:
    """Retrieve virtual pot balances and targets for the caller's household."""
    household_id = _household_id()
    try:
        async with async_session_factory() as session:
            repo = PotRepository(session)
            service = PotService(repo)
            pots = await service.list_pots(household_id=household_id, include_inactive=False)

            if not pots:
                return f"No active pots found for household {household_id}."

            lines = [f"Virtual Pots for Household {household_id}:"]
            for pot in pots:
                target_str = f" / {pot.target_amount}" if pot.target_amount is not None else ""
                lines.append(
                    f"- {pot.name} (Priority {pot.priority}): {pot.current_amount}{target_str} "
                    f"[{pot.overflow_target.value}]"
                )
            return "\n".join(lines)
    except Exception as e:
        return f"Error fetching pot balances: {e!s}"


@mcp.tool()
async def suggest_budget_allocation(income: float) -> str:
    """Calculate and suggest budget distribution across pots based on priority cascade.

    Parameters:
    - income: Total income or funds available for allocation.
    """
    household_id = _household_id()
    try:
        async with async_session_factory() as session:
            repo = PotRepository(session)
            service = PotService(repo)

            pots = await repo.list_ordered_by_priority(household_id=household_id)
            if not pots:
                return f"No active pots available for budget allocation in household {household_id}."

            amount = Decimal(str(income))
            unassigned, investment_overflow, allocations = service._calculate_cascade(pots, amount)

            lines = [f"Suggested Budget Allocation for Income: {amount}:"]
            for alloc in allocations:
                filled_str = " (Filled)" if alloc.is_filled else ""
                lines.append(
                    f"- {alloc.pot_name} (Priority {alloc.priority}): Allocated {alloc.allocated_amount}"
                    f" -> New Total: {alloc.new_current_amount}{filled_str}"
                )

            if unassigned > Decimal("0.00"):
                lines.append(f"Unassigned Buffer: {unassigned}")
            if investment_overflow > Decimal("0.00"):
                lines.append(f"Overflow to Investment: {investment_overflow}")

            return "\n".join(lines)
    except Exception as e:
        return f"Error suggesting budget allocation: {e!s}"


@mcp.tool()
async def analyze_spending_gap(month: str) -> str:
    """Analyze the spending gap between planned budget allocations and actual transaction expenses.

    Parameters:
    - month: Month string (e.g., 'YYYY-MM' format).
    """
    household_id = _household_id()
    try:
        date_from, date_to = _month_bounds(month)
    except ValueError:
        return f"Error analyzing spending gap: invalid month '{month}', expected 'YYYY-MM' format."

    try:
        async with async_session_factory() as session:
            plan_service = PlanService(session)
            plans = await plan_service.list_plans(household_id=household_id, include_inactive=False)

            tx_repo = TransactionRepository(session)
            tx_service = TransactionService(tx_repo)
            # Aggregate directly in the database over the requested month, rather than paging
            # through the most recent N transactions in Python -- that silently missed older
            # months once a household passed N total transactions.
            total_spent = await tx_service.sum_expenses_in_range(
                household_id=household_id, date_from=date_from, date_to=date_to
            )
            tx_count = await tx_service.count_in_range(household_id=household_id, date_from=date_from, date_to=date_to)

            total_planned = sum((plan.total_budget for plan in plans), Decimal("0.00"))

            gap = total_spent - total_planned
            has_overspend = gap > Decimal("0.00")
            gap_status = "OVER BUDGET" if has_overspend else "UNDER BUDGET"

            lines = [
                f"Spending Gap Analysis for {month} (Household {household_id}):",
                f"- Total Budgeted Plans: {total_planned}",
                f"- Total Actual Expenses: {total_spent}",
                f"- Spending Gap: {gap:+} ({gap_status})",
                f"- Transactions Analyzed: {tx_count}",
            ]
            return "\n".join(lines)
    except Exception as e:
        return f"Error analyzing spending gap: {e!s}"


@mcp.tool()
async def calculate_sinking_gap(pot_id: UUID) -> str:
    """Calculate the sinking fund gap and required monthly contribution rate for a virtual pot.

    Parameters:
    - pot_id: UUID of the virtual pot.
    """
    household_id = _household_id()
    try:
        async with async_session_factory() as session:
            repo = PotRepository(session)
            service = PotService(repo)
            calc = await service.calculate_sinking_fund_gap(pot_id=pot_id, household_id=household_id)

            lines = [
                f"Sinking Fund Analysis for Pot '{calc.pot_name}' ({calc.pot_id}):",
                f"- Target Amount: {calc.target_amount or 'N/A'}",
                f"- Current Amount: {calc.current_amount}",
                f"- Shortfall: {calc.shortfall}",
                f"- Target Date: {calc.target_date or 'N/A'} ({calc.remaining_months} months remaining)",
                f"- Target Monthly Rate: {calc.target_monthly_rate}",
                f"- Actual Monthly Rate: {calc.actual_monthly_rate}",
                f"- Monthly Gap: {calc.gap}",
                f"- Status: {calc.status}",
            ]
            return "\n".join(lines)
    except Exception as e:
        return f"Error calculating sinking fund gap: {e!s}"
