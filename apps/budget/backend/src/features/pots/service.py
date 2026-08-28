from collections.abc import Sequence
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from src.features.pots.models import (
    CascadeAllocationResponse,
    MaintenanceReserveRequest,
    OverflowTarget,
    Pot,
    PotAllocationResult,
    PotCreate,
    PotRead,
    PotUpdate,
    SinkingFundCalculationResponse,
)
from src.features.pots.repository import PotRepository


class PotService:
    """Service handling business logic, priority cascades, and sinking fund calculations."""

    def __init__(self, repository: PotRepository) -> None:
        self.repository = repository

    async def create_pot(self, household_id: UUID, pot_in: PotCreate) -> Pot:
        """Create a new virtual pot for the household."""
        return await self.repository.create(household_id=household_id, pot_in=pot_in)

    async def get_pot(self, pot_id: UUID, household_id: UUID) -> Pot:
        """Retrieve a pot by ID, raising HTTP 404 if not found."""
        pot = await self.repository.get_by_id(pot_id=pot_id, household_id=household_id)
        if not pot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pot not found",
            )
        return pot

    async def list_pots(self, household_id: UUID, include_inactive: bool = False) -> Sequence[Pot]:
        """List pots for household."""
        return await self.repository.list_by_household(household_id=household_id, include_inactive=include_inactive)

    async def update_pot(self, pot_id: UUID, household_id: UUID, pot_update: PotUpdate) -> Pot:
        """Update an existing pot for the specified household."""
        pot = await self.get_pot(pot_id=pot_id, household_id=household_id)
        return await self.repository.update(pot=pot, pot_update=pot_update)

    async def delete_pot(self, pot_id: UUID, household_id: UUID) -> None:
        """Delete a pot for the specified household."""
        pot = await self.get_pot(pot_id=pot_id, household_id=household_id)
        await self.repository.delete(pot=pot)

    async def allocate_cascade(self, household_id: UUID, amount: Decimal) -> CascadeAllocationResponse:
        """Distribute funds across active pots according to priority cascade and overflow settings."""
        pots = await self.repository.list_ordered_by_priority(household_id=household_id)
        if not pots:
            return CascadeAllocationResponse(
                total_allocated=Decimal("0.00"),
                remaining_unassigned=amount,
                overflow_to_investment=Decimal("0.00"),
                allocations=[],
            )

        unassigned, investment_overflow, allocations = self._calculate_cascade(pots, amount)

        # Persist updated balances to database
        for pot in pots:
            pot.updated_at = datetime.now(UTC)
            self.repository.session.add(pot)
        await self.repository.session.commit()

        total_allocated = amount - unassigned - investment_overflow

        return CascadeAllocationResponse(
            total_allocated=total_allocated,
            remaining_unassigned=unassigned,
            overflow_to_investment=investment_overflow,
            allocations=allocations,
        )

    def _calculate_cascade(
        self,
        pots: Sequence[Pot],
        amount: Decimal,
    ) -> tuple[Decimal, Decimal, list[PotAllocationResult]]:
        """Private helper function calculating priority cascade distribution and overflow routing."""
        remaining_funds = amount
        remaining_unassigned = Decimal("0.00")
        overflow_to_investment = Decimal("0.00")
        allocations: list[PotAllocationResult] = []

        for pot in pots:
            if remaining_funds <= Decimal("0.00"):
                break

            target = pot.target_amount
            current = pot.current_amount

            if target is not None:
                shortfall = max(Decimal("0.00"), target - current)
                if shortfall <= Decimal("0.00"):
                    # Pot is already full
                    if pot.overflow_target == OverflowTarget.UNASSIGNED:
                        remaining_unassigned += remaining_funds
                        remaining_funds = Decimal("0.00")
                    elif pot.overflow_target == OverflowTarget.INVESTMENT:
                        overflow_to_investment += remaining_funds
                        remaining_funds = Decimal("0.00")
                    # CASCADE option continues loop to next priority pot
                    continue

                allocation = min(remaining_funds, shortfall)
                pot.current_amount += allocation
                remaining_funds -= allocation

                is_filled = pot.current_amount >= target
                allocations.append(
                    PotAllocationResult(
                        pot_id=pot.id,
                        pot_name=pot.name,
                        priority=pot.priority,
                        allocated_amount=allocation,
                        new_current_amount=pot.current_amount,
                        target_amount=pot.target_amount,
                        is_filled=is_filled,
                    )
                )

                if remaining_funds > Decimal("0.00") and is_filled:
                    if pot.overflow_target == OverflowTarget.UNASSIGNED:
                        remaining_unassigned += remaining_funds
                        remaining_funds = Decimal("0.00")
                    elif pot.overflow_target == OverflowTarget.INVESTMENT:
                        overflow_to_investment += remaining_funds
                        remaining_funds = Decimal("0.00")
            else:
                # Pot without target absorbs all remaining funds
                allocation = remaining_funds
                pot.current_amount += allocation
                remaining_funds = Decimal("0.00")

                allocations.append(
                    PotAllocationResult(
                        pot_id=pot.id,
                        pot_name=pot.name,
                        priority=pot.priority,
                        allocated_amount=allocation,
                        new_current_amount=pot.current_amount,
                        target_amount=None,
                        is_filled=False,
                    )
                )

        if remaining_funds > Decimal("0.00"):
            remaining_unassigned += remaining_funds

        return remaining_unassigned, overflow_to_investment, allocations

    async def calculate_sinking_fund_gap(
        self,
        pot_id: UUID,
        household_id: UUID,
        reference_date: date | None = None,
    ) -> SinkingFundCalculationResponse:
        """Compute dynamic target savings rate vs actual rate and report gap warnings."""
        pot = await self.get_pot(pot_id=pot_id, household_id=household_id)
        ref_date = reference_date or date.today()

        if pot.target_amount is None or pot.target_amount <= Decimal("0.00"):
            return SinkingFundCalculationResponse(
                pot_id=pot.id,
                pot_name=pot.name,
                target_amount=pot.target_amount,
                current_amount=pot.current_amount,
                shortfall=Decimal("0.00"),
                target_date=pot.target_date,
                remaining_months=0,
                target_monthly_rate=Decimal("0.00"),
                actual_monthly_rate=pot.monthly_contribution,
                gap=Decimal("0.00"),
                has_gap=False,
                status="NO_TARGET",
            )

        shortfall = max(Decimal("0.00"), pot.target_amount - pot.current_amount)
        if shortfall <= Decimal("0.00"):
            return SinkingFundCalculationResponse(
                pot_id=pot.id,
                pot_name=pot.name,
                target_amount=pot.target_amount,
                current_amount=pot.current_amount,
                shortfall=Decimal("0.00"),
                target_date=pot.target_date,
                remaining_months=0,
                target_monthly_rate=Decimal("0.00"),
                actual_monthly_rate=pot.monthly_contribution,
                gap=Decimal("0.00"),
                has_gap=False,
                status="COMPLETED",
            )

        if pot.target_date is None or pot.target_date <= ref_date:
            remaining_months = 1
        else:
            remaining_months = max(
                1,
                (pot.target_date.year - ref_date.year) * 12 + (pot.target_date.month - ref_date.month),
            )

        target_monthly_rate = round(shortfall / Decimal(str(remaining_months)), 2)
        actual_monthly_rate = pot.monthly_contribution
        gap = max(Decimal("0.00"), target_monthly_rate - actual_monthly_rate)
        has_gap = gap > Decimal("0.00")
        status_label = "WARNING" if has_gap else "ON_TRACK"

        return SinkingFundCalculationResponse(
            pot_id=pot.id,
            pot_name=pot.name,
            target_amount=pot.target_amount,
            current_amount=pot.current_amount,
            shortfall=shortfall,
            target_date=pot.target_date,
            remaining_months=remaining_months,
            target_monthly_rate=target_monthly_rate,
            actual_monthly_rate=actual_monthly_rate,
            gap=gap,
            has_gap=has_gap,
            status=status_label,
        )

    async def create_maintenance_reserve(
        self,
        household_id: UUID,
        req: MaintenanceReserveRequest,
    ) -> PotRead:
        """Create or update a maintenance reserve pot triggered by external services."""
        existing_pot = await self.repository.get_by_name(name=req.title, household_id=household_id)

        if existing_pot:
            pot_update = PotUpdate(
                target_amount=req.required_amount,
                target_date=req.due_date,
                priority=req.priority,
            )
            updated_pot = await self.repository.update(pot=existing_pot, pot_update=pot_update)
            return PotRead.model_validate(updated_pot)

        pot_in = PotCreate(
            name=req.title,
            priority=req.priority,
            target_amount=req.required_amount,
            current_amount=Decimal("0.00"),
            target_date=req.due_date,
            overflow_target=OverflowTarget.CASCADE,
        )
        new_pot = await self.repository.create(household_id=household_id, pot_in=pot_in)
        return PotRead.model_validate(new_pot)
