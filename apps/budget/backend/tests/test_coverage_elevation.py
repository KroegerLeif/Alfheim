from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.audit.repository import AuditRepository
from src.core.config import Settings
from src.features.accounts.models import AccountCreate, AccountType, AccountUpdate
from src.features.accounts.repository import AccountRepository
from src.features.accounts.service import AccountService
from src.features.plans.models import (
    PlanCategoryCreate,
    PlanCategoryUpdate,
    PlanCreate,
    PlanType,
    PlanUpdate,
)
from src.features.plans.repository import PlanRepository
from src.features.plans.service import PlanService
from src.features.pots.models import (
    MaintenanceReserveRequest,
    OverflowTarget,
    PotCreate,
    PotUpdate,
)
from src.features.pots.repository import PotRepository
from src.features.pots.service import PotService
from src.features.transactions.models import TransactionCreate, TransactionType, TransactionUpdate
from src.features.transactions.repository import TransactionRepository
from src.features.transactions.service import TransactionService
from tests.test_plans import create_auth_headers


def test_settings_properties():
    """Verify Settings property accessors for Keycloak JWKS and Issuer URLs."""
    s1 = Settings(KEYCLOAK_JWKS_URL="http://custom/jwks")
    assert s1.jwks_url == "http://custom/jwks"

    s2 = Settings(
        KEYCLOAK_URL="http://keycloak:8080/auth/",
        KEYCLOAK_PUBLIC_URL="http://public.auth/realm/",
        KEYCLOAK_REALM="alfheim",
        KEYCLOAK_JWKS_URL="",
    )
    assert s2.jwks_url == "http://keycloak:8080/auth/realms/alfheim/protocol/openid-connect/certs"
    assert s2.expected_issuer == "http://public.auth/realm/realms/alfheim"


@pytest.mark.asyncio
async def test_plan_service_and_repository_edge_cases(db_session: AsyncSession):
    """Verify PlanService 400/404 handling, category hierarchy trees, and repository filters."""
    service = PlanService(db_session)
    repo = PlanRepository(db_session)
    household_id = uuid4()
    non_existent_id = uuid4()

    # Plan 404s
    with pytest.raises(HTTPException) as exc_info:
        await service.get_plan(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        await service.update_plan(non_existent_id, household_id, PlanUpdate(name="Test"))
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        await service.delete_plan(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        await service.get_plan_summary(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    # Create plan for category tests
    plan = await service.create_plan(
        household_id,
        PlanCreate(
            name="Main Plan",
            plan_type=PlanType.MONTHLY,
            total_budget=Decimal("2000.00"),
        ),
    )

    # Repository list with include_inactive=True
    plans = await repo.list_plans_by_household(household_id, include_inactive=True)
    assert len(plans) >= 1

    # Category on non-existent plan
    with pytest.raises(HTTPException) as exc_info:
        await service.create_category(
            non_existent_id,
            household_id,
            PlanCategoryCreate(name="Groceries", allocated_amount=Decimal("500.00")),
        )
    assert exc_info.value.status_code == 404

    # Category with non-existent parent
    with pytest.raises(HTTPException) as exc_info:
        await service.create_category(
            plan.id,
            household_id,
            PlanCategoryCreate(
                name="Organic",
                allocated_amount=Decimal("100.00"),
                parent_id=non_existent_id,
            ),
        )
    assert exc_info.value.status_code == 400

    # Create parent category
    parent_cat = await service.create_category(
        plan.id,
        household_id,
        PlanCategoryCreate(name="Food", allocated_amount=Decimal("600.00")),
    )

    # Create subcategory under parent
    child_cat = await service.create_category(
        plan.id,
        household_id,
        PlanCategoryCreate(
            name="Groceries",
            allocated_amount=Decimal("400.00"),
            parent_id=parent_cat.id,
        ),
    )

    # Update category 404
    with pytest.raises(HTTPException) as exc_info:
        await service.update_category(
            non_existent_id,
            household_id,
            PlanCategoryUpdate(name="Missing"),
        )
    assert exc_info.value.status_code == 404

    # Update category self as parent 400
    with pytest.raises(HTTPException) as exc_info:
        await service.update_category(
            child_cat.id,
            household_id,
            PlanCategoryUpdate(parent_id=child_cat.id),
        )
    assert exc_info.value.status_code == 400

    # Update category non-existent parent 400
    with pytest.raises(HTTPException) as exc_info:
        await service.update_category(
            child_cat.id,
            household_id,
            PlanCategoryUpdate(parent_id=non_existent_id),
        )
    assert exc_info.value.status_code == 400

    # Update category valid
    updated_cat = await service.update_category(
        child_cat.id,
        household_id,
        PlanCategoryUpdate(name="Supermarket Groceries"),
    )
    assert updated_cat.name == "Supermarket Groceries"

    # Plan summary with nested category tree
    summary = await service.get_plan_summary(plan.id, household_id)
    assert summary.total_allocated == Decimal("1000.00")
    assert summary.unallocated_balance == Decimal("1000.00")
    assert len(summary.categories) == 1
    assert len(summary.categories[0].subcategories) == 1

    # Delete category 404
    with pytest.raises(HTTPException) as exc_info:
        await service.delete_category(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    # Delete categories and plan success
    await service.delete_category(child_cat.id, household_id)
    await service.delete_category(parent_cat.id, household_id)
    await service.delete_plan(plan.id, household_id)


@pytest.mark.asyncio
async def test_pot_service_and_repository_edge_cases(db_session: AsyncSession):
    """Verify PotService cascade overflow routing, sinking fund statuses, and maintenance reserves."""
    repo = PotRepository(db_session)
    service = PotService(repo)
    household_id = uuid4()
    non_existent_id = uuid4()

    # Pot 404s
    with pytest.raises(HTTPException) as exc_info:
        await service.get_pot(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    # Cascade allocation when no pots exist
    empty_cascade = await service.allocate_cascade(household_id, Decimal("500.00"))
    assert empty_cascade.total_allocated == Decimal("0.00")
    assert empty_cascade.remaining_unassigned == Decimal("500.00")

    # Create pot without target amount (absorbs all remainder)
    pot_no_target = await service.create_pot(
        household_id,
        PotCreate(
            name="General Savings",
            priority=1,
            current_amount=Decimal("0.00"),
            target_amount=None,
        ),
    )

    cascade1 = await service.allocate_cascade(household_id, Decimal("300.00"))
    assert cascade1.total_allocated == Decimal("300.00")
    assert cascade1.remaining_unassigned == Decimal("0.00")
    await service.delete_pot(pot_no_target.id, household_id)

    # Create full pot with OverflowTarget.UNASSIGNED
    pot_unassigned = await service.create_pot(
        household_id,
        PotCreate(
            name="Emergency Fund",
            priority=1,
            current_amount=Decimal("1000.00"),
            target_amount=Decimal("1000.00"),
            overflow_target=OverflowTarget.UNASSIGNED,
        ),
    )
    cascade_unassigned = await service.allocate_cascade(household_id, Decimal("200.00"))
    assert cascade_unassigned.remaining_unassigned == Decimal("200.00")
    assert cascade_unassigned.total_allocated == Decimal("0.00")
    await service.delete_pot(pot_unassigned.id, household_id)

    # Create full pot with OverflowTarget.INVESTMENT
    pot_invest = await service.create_pot(
        household_id,
        PotCreate(
            name="Travel Fund",
            priority=1,
            current_amount=Decimal("500.00"),
            target_amount=Decimal("500.00"),
            overflow_target=OverflowTarget.INVESTMENT,
        ),
    )
    cascade_invest = await service.allocate_cascade(household_id, Decimal("250.00"))
    assert cascade_invest.overflow_to_investment == Decimal("250.00")
    await service.delete_pot(pot_invest.id, household_id)

    # Sinking fund gap - NO_TARGET
    pot_untargeted = await service.create_pot(
        household_id,
        PotCreate(name="Fun Money", priority=10, current_amount=Decimal("50.00"), target_amount=None),
    )
    gap_untargeted = await service.calculate_sinking_fund_gap(pot_untargeted.id, household_id)
    assert gap_untargeted.status == "NO_TARGET"

    # Sinking fund gap - COMPLETED
    pot_completed = await service.create_pot(
        household_id,
        PotCreate(
            name="New Laptop",
            priority=2,
            current_amount=Decimal("1500.00"),
            target_amount=Decimal("1500.00"),
        ),
    )
    gap_completed = await service.calculate_sinking_fund_gap(pot_completed.id, household_id)
    assert gap_completed.status == "COMPLETED"

    # Sinking fund gap - past target date (remaining_months=1)
    past_pot = await service.create_pot(
        household_id,
        PotCreate(
            name="Overdue Tax",
            priority=1,
            current_amount=Decimal("100.00"),
            target_amount=Decimal("500.00"),
            target_date=date.today() - timedelta(days=30),
            monthly_contribution=Decimal("50.00"),
        ),
    )
    gap_past = await service.calculate_sinking_fund_gap(past_pot.id, household_id)
    assert gap_past.remaining_months == 1
    assert gap_past.has_gap is True
    assert gap_past.status == "WARNING"

    # Maintenance Reserve - Create new pot
    reserve_req = MaintenanceReserveRequest(
        title="Roof Repair",
        required_amount=Decimal("3000.00"),
        due_date=date.today() + timedelta(days=180),
        priority=1,
    )
    reserve_pot = await service.create_maintenance_reserve(household_id, reserve_req)
    assert reserve_pot.name == "Roof Repair"
    assert reserve_pot.target_amount == Decimal("3000.00")

    # Maintenance Reserve - Update existing pot
    reserve_req_updated = MaintenanceReserveRequest(
        title="Roof Repair",
        required_amount=Decimal("3500.00"),
        due_date=date.today() + timedelta(days=200),
        priority=2,
    )
    updated_reserve = await service.create_maintenance_reserve(household_id, reserve_req_updated)
    assert updated_reserve.target_amount == Decimal("3500.00")
    assert updated_reserve.priority == 2

    # Repository list with include_inactive=True
    all_pots = await repo.list_by_household(household_id, include_inactive=True)
    assert len(all_pots) >= 1


@pytest.mark.asyncio
async def test_account_and_transaction_service_edge_cases(db_session: AsyncSession):
    """Verify Account and Transaction service 404s, net worth edge cases, and audit queries."""
    acc_repo = AccountRepository(db_session)
    acc_service = AccountService(acc_repo)
    tx_repo = TransactionRepository(db_session)
    tx_service = TransactionService(tx_repo)
    audit_repo = AuditRepository(db_session)

    household_id = uuid4()
    non_existent_id = uuid4()

    # Account 404s
    with pytest.raises(HTTPException) as exc_info:
        await acc_service.get_account(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        await acc_service.update_account(non_existent_id, household_id, AccountUpdate(name="Test"))
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        await acc_service.delete_account(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    # Net worth and balance summary with no accounts
    empty_nw = await acc_service.get_net_worth_summary(household_id)
    assert empty_nw.total_net_worth == Decimal("0.00")
    empty_bs = await acc_service.get_balance_summary(household_id)
    assert empty_bs.total_balance == Decimal("0.00")

    # Create account
    account = await acc_service.create_account(
        household_id,
        AccountCreate(
            name="Checking",
            account_type=AccountType.CHECKING,
            currency="EUR",
            initial_balance=Decimal("1500.00"),
        ),
    )

    # Repository list with include_inactive=True
    accounts = await acc_repo.list_by_household(household_id, include_inactive=True)
    assert len(accounts) >= 1

    # Transaction 404s
    with pytest.raises(HTTPException) as exc_info:
        await tx_service.get_transaction(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        await tx_service.update_transaction(non_existent_id, household_id, TransactionUpdate(description="Missing"))
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        await tx_service.delete_transaction(non_existent_id, household_id)
    assert exc_info.value.status_code == 404

    # Create transaction and quick add
    tx = await tx_service.create_transaction(
        household_id,
        TransactionCreate(
            description="Supermarket",
            account_id=account.id,
            amount=Decimal("50.00"),
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date.today(),
        ),
    )
    assert tx.id is not None

    # Filtered transaction listing
    txs = await tx_service.list_transactions(
        household_id,
        account_id=account.id,
        limit=10,
        offset=0,
    )
    assert len(txs) >= 1

    # Delete transaction
    await tx_service.delete_transaction(tx.id, household_id)

    # Audit repository listing
    logs_hh = await audit_repo.get_by_household(household_id)
    assert isinstance(logs_hh, list)
    logs_entity = await audit_repo.get_by_entity("Account", account.id)
    assert isinstance(logs_entity, list)


@pytest.mark.asyncio
async def test_router_404_endpoints(client: AsyncClient):
    """Verify HTTP 404 responses across account, pot, plan, and transaction routers."""
    headers = create_auth_headers()
    random_id = uuid4()

    res = await client.get(f"/api/v1/accounts/{random_id}", headers=headers)
    assert res.status_code == 404

    res = await client.patch(f"/api/v1/accounts/{random_id}", headers=headers, json={"name": "New"})
    assert res.status_code == 404

    res = await client.delete(f"/api/v1/accounts/{random_id}", headers=headers)
    assert res.status_code == 404

    res = await client.get(f"/api/v1/pots/{random_id}", headers=headers)
    assert res.status_code == 404

    res = await client.patch(f"/api/v1/pots/{random_id}", headers=headers, json={"name": "New"})
    assert res.status_code == 404

    res = await client.delete(f"/api/v1/pots/{random_id}", headers=headers)
    assert res.status_code == 404

    res = await client.get(f"/api/v1/plans/{random_id}", headers=headers)
    assert res.status_code == 404

    res = await client.get(f"/api/v1/transactions/{random_id}", headers=headers)
    assert res.status_code == 404

    res = await client.delete(f"/api/v1/transactions/{random_id}", headers=headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_service_crud_success_paths_and_database(db_session: AsyncSession):
    """Verify service CRUD success paths for plans, accounts, pots, and transactions."""
    from unittest.mock import AsyncMock, patch

    from src.core.database import get_db_session

    household_id = uuid4()

    # PlanService get and update
    plan_service = PlanService(db_session)
    plan = await plan_service.create_plan(
        household_id,
        PlanCreate(name="Plan Alpha", plan_type=PlanType.MONTHLY, total_budget=Decimal("1000.00")),
    )
    fetched_plan = await plan_service.get_plan(plan.id, household_id)
    assert fetched_plan.id == plan.id

    updated_plan = await plan_service.update_plan(plan.id, household_id, PlanUpdate(name="Plan Beta"))
    assert updated_plan.name == "Plan Beta"

    # AccountService get, update, delete
    acc_repo = AccountRepository(db_session)
    acc_service = AccountService(acc_repo)
    acc = await acc_service.create_account(
        household_id,
        AccountCreate(name="Daily Card", account_type=AccountType.CHECKING, currency="EUR"),
    )
    fetched_acc = await acc_service.get_account(acc.id, household_id)
    assert fetched_acc.id == acc.id

    updated_acc = await acc_service.update_account(acc.id, household_id, AccountUpdate(name="Daily Debit"))
    assert updated_acc.name == "Daily Debit"

    await acc_service.delete_account(acc.id, household_id)

    # PotService update
    pot_repo = PotRepository(db_session)
    pot_service = PotService(pot_repo)
    pot = await pot_service.create_pot(
        household_id,
        PotCreate(name="Car Fund", priority=1, current_amount=Decimal("100.00")),
    )
    updated_pot = await pot_service.update_pot(pot.id, household_id, PotUpdate(name="Auto Fund"))
    assert updated_pot.name == "Auto Fund"

    # TransactionService update
    tx_repo = TransactionRepository(db_session)
    tx_service = TransactionService(tx_repo)
    tx = await tx_service.create_transaction(
        household_id,
        TransactionCreate(
            description="Bakery",
            amount=Decimal("4.50"),
            transaction_type=TransactionType.EXPENSE,
            transaction_date=date.today(),
        ),
    )
    updated_tx = await tx_service.update_transaction(
        tx.id,
        household_id,
        TransactionUpdate(description="Pastry Shop"),
    )
    assert updated_tx.description == "Pastry Shop"

    # Database get_db_session generator
    with patch("src.core.database.async_session_factory") as mock_factory:
        mock_ctx = AsyncMock()
        mock_factory.return_value.__aenter__.return_value = mock_ctx
        gen = get_db_session()
        s = await anext(gen)
        assert s == mock_ctx
