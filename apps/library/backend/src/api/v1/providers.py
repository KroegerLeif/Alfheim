"""API router for streaming provider subscription management."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.db.models import ProviderSubscription
from src.schemas.providers import (
    ProviderCreate,
    ProviderResponse,
    ProviderUpdate,
)

router = APIRouter(prefix="/providers", tags=["providers"])


async def _get_provider_or_404(
    provider_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> ProviderSubscription:
    """Retrieve provider subscription by ID for active household or raise 404 HTTP Exception."""
    statement = select(ProviderSubscription).where(
        ProviderSubscription.id == provider_id,
        ProviderSubscription.household_id == household_id,
    )
    result = await session.execute(statement)
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider subscription with ID '{provider_id}' not found.",
        )
    return provider


@router.post(
    "",
    response_model=ProviderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create provider subscription",
)
async def create_provider(
    payload: ProviderCreate,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Create a new streaming provider subscription for the active household."""
    provider = ProviderSubscription(
        household_id=household_id,
        **payload.model_dump(),
    )
    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return provider


@router.get(
    "",
    response_model=list[ProviderResponse],
    summary="List provider subscriptions",
)
async def list_providers(
    is_active: bool | None = Query(default=None, description="Filter providers by active status."),
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """List streaming provider subscriptions for active household."""
    statement = select(ProviderSubscription).where(
        ProviderSubscription.household_id == household_id,
    )
    if is_active is not None:
        statement = statement.where(ProviderSubscription.is_active == is_active)

    result = await session.execute(statement)
    providers = list(result.scalars().all())
    return providers


@router.get(
    "/{provider_id}",
    response_model=ProviderResponse,
    summary="Get provider subscription details",
)
async def get_provider(
    provider_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Retrieve details of a single streaming provider subscription."""
    return await _get_provider_or_404(provider_id, household_id, session)


@router.put(
    "/{provider_id}",
    response_model=ProviderResponse,
    summary="Update provider subscription",
)
async def update_provider(
    provider_id: uuid.UUID,
    payload: ProviderUpdate,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Update details of a streaming provider subscription."""
    provider = await _get_provider_or_404(provider_id, household_id, session)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(provider, field, value)

    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return provider


@router.delete(
    "/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete provider subscription",
)
async def delete_provider(
    provider_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a streaming provider subscription from the household."""
    provider = await _get_provider_or_404(provider_id, household_id, session)
    await session.delete(provider)
    await session.commit()
