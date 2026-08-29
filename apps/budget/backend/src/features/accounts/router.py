from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import TenantContext, get_current_tenant, get_db_session
from src.features.accounts.models import (
    AccountCreate,
    AccountRead,
    AccountUpdate,
    BalanceSummaryResponse,
    NetWorthResponse,
)
from src.features.accounts.repository import AccountRepository
from src.features.accounts.service import AccountService

router = APIRouter()


def get_account_service(
    session: AsyncSession = Depends(get_db_session),
) -> AccountService:
    """Dependency helper to instantiate AccountService with session repository."""
    repository = AccountRepository(session)
    return AccountService(repository)


@router.post("/", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_in: AccountCreate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: AccountService = Depends(get_account_service),
) -> AccountRead:
    """Create a new account for the authenticated household."""
    account = await service.create_account(
        household_id=tenant.household_id,
        account_in=account_in,
    )
    return AccountRead.model_validate(account)


@router.get("/", response_model=list[AccountRead])
async def list_accounts(
    include_inactive: bool = Query(default=False),
    tenant: TenantContext = Depends(get_current_tenant),
    service: AccountService = Depends(get_account_service),
) -> Sequence[AccountRead]:
    """List all accounts for the authenticated household."""
    accounts = await service.list_accounts(
        household_id=tenant.household_id,
        include_inactive=include_inactive,
    )
    return [AccountRead.model_validate(a) for a in accounts]


@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth_summary(
    tenant: TenantContext = Depends(get_current_tenant),
    service: AccountService = Depends(get_account_service),
) -> NetWorthResponse:
    """Calculate net worth aggregate summary for active household."""
    return await service.get_net_worth_summary(household_id=tenant.household_id)


@router.get("/summary", response_model=BalanceSummaryResponse)
async def get_balance_summary(
    tenant: TenantContext = Depends(get_current_tenant),
    service: AccountService = Depends(get_account_service),
) -> BalanceSummaryResponse:
    """Get balance breakdown by account type for active household."""
    return await service.get_balance_summary(household_id=tenant.household_id)


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(
    account_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: AccountService = Depends(get_account_service),
) -> AccountRead:
    """Get account details by ID for active household."""
    account = await service.get_account(
        account_id=account_id,
        household_id=tenant.household_id,
    )
    return AccountRead.model_validate(account)


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: UUID,
    account_update: AccountUpdate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: AccountService = Depends(get_account_service),
) -> AccountRead:
    """Update an existing account for active household."""
    account = await service.update_account(
        account_id=account_id,
        household_id=tenant.household_id,
        account_update=account_update,
    )
    return AccountRead.model_validate(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: AccountService = Depends(get_account_service),
) -> None:
    """Delete an account for active household."""
    await service.delete_account(
        account_id=account_id,
        household_id=tenant.household_id,
    )
