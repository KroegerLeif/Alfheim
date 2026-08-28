"""API router for library item search and multi-facet filtering."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.db.models import MediaType
from src.schemas.items import ItemListResponse
from src.services.search import search_items

router = APIRouter(prefix="/search", tags=["search"])


@router.get(
    "",
    response_model=ItemListResponse,
    summary="Search library items",
)
async def search_library(
    q: str | None = Query(default=None, alias="q", description="Full-text search query string."),
    query: str | None = Query(default=None, description="Search query string alias."),
    media_type: MediaType | None = Query(default=None, description="Filter items by media type."),
    is_cookbook: bool | None = Query(default=None, description="Filter items by cookbook flag."),
    min_players: int | None = Query(default=None, ge=1, description="Filter games by minimum players requirement."),
    max_players: int | None = Query(default=None, ge=1, description="Filter games by maximum players limit."),
    players: int | None = Query(
        default=None, ge=1, description="Filter games supporting specified target player count."
    ),
    max_duration: int | None = Query(
        default=None, ge=1, description="Filter items with runtime_minutes <= max_duration."
    ),
    fsk_rating: int | None = Query(
        default=None, ge=0, le=18, description="Filter items with FSK rating <= fsk_rating."
    ),
    provider_id: uuid.UUID | None = Query(
        default=None, description="Filter items linked to a specific streaming provider ID."
    ),
    active_providers_only: bool = Query(
        default=False, description="Filter items linked to active household streaming provider subscriptions."
    ),
    skip: int = Query(default=0, ge=0, description="Pagination offset count."),
    limit: int = Query(default=50, ge=1, le=100, description="Pagination limit count."),
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Execute multi-facet search across media items in active household."""
    text_query = q or query
    items, total = await search_items(
        session=session,
        household_id=household_id,
        query=text_query,
        media_type=media_type,
        is_cookbook=is_cookbook,
        min_players=min_players,
        max_players=max_players,
        players=players,
        max_duration=max_duration,
        fsk_rating=fsk_rating,
        provider_id=provider_id,
        active_providers_only=active_providers_only,
        skip=skip,
        limit=limit,
    )

    return ItemListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )
