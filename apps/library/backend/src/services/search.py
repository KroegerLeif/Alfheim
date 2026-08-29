"""Search service providing full-text search and multi-facet filtering for library items."""

import logging
import uuid

from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select
from src.db.models import Item, MediaType, ProviderSubscription

logger = logging.getLogger("library.backend.services.search")


async def search_items(
    session: AsyncSession,
    household_id: uuid.UUID,
    query: str | None = None,
    media_type: MediaType | None = None,
    is_cookbook: bool | None = None,
    min_players: int | None = None,
    max_players: int | None = None,
    players: int | None = None,
    max_duration: int | None = None,
    fsk_rating: int | None = None,
    provider_id: uuid.UUID | None = None,
    active_providers_only: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Item], int]:
    """Search and filter household library items with multi-facet filters.

    Returns a tuple containing the list of matching Item objects and total matching count.
    """
    stmt = select(Item).where(Item.household_id == household_id)

    # Text search
    if query and query.strip():
        q_clean = query.strip()
        dialect_name = session.bind.dialect.name if session.bind else "postgresql"

        if dialect_name == "postgresql":
            search_vector = func.to_tsvector(
                "english",
                func.coalesce(Item.title, "")
                + " "
                + func.coalesce(Item.description, "")
                + " "
                + func.coalesce(Item.author_creator, ""),
            )
            ts_query = func.plainto_tsquery("english", q_clean)
            pattern = f"%{q_clean}%"
            stmt = stmt.where(
                or_(
                    search_vector.op("@@")(ts_query),
                    col(Item.title).ilike(pattern),
                    col(Item.author_creator).ilike(pattern),
                    col(Item.description).ilike(pattern),
                )
            )
        else:
            pattern = f"%{q_clean}%"
            stmt = stmt.where(
                or_(
                    col(Item.title).ilike(pattern),
                    col(Item.author_creator).ilike(pattern),
                    col(Item.description).ilike(pattern),
                )
            )

    # Media type filter
    if media_type is not None:
        stmt = stmt.where(Item.media_type == media_type)

    # Cookbook flag filter
    if is_cookbook is not None:
        stmt = stmt.where(Item.is_cookbook == is_cookbook)

    # Player count fit filter (e.g. "4-player game")
    if players is not None:
        stmt = stmt.where(
            or_(col(Item.min_players).is_(None), col(Item.min_players) <= players),
            or_(col(Item.max_players).is_(None), col(Item.max_players) >= players),
        )

    # Min/Max player constraints
    if min_players is not None:
        stmt = stmt.where(col(Item.min_players).is_not(None), col(Item.min_players) >= min_players)
    if max_players is not None:
        stmt = stmt.where(col(Item.max_players).is_not(None), col(Item.max_players) <= max_players)

    # Max duration filter (e.g. "under 90 min")
    if max_duration is not None:
        stmt = stmt.where(col(Item.runtime_minutes).is_not(None), col(Item.runtime_minutes) <= max_duration)

    # Age rating (FSK) filter
    if fsk_rating is not None:
        stmt = stmt.where(col(Item.fsk_rating).is_not(None), col(Item.fsk_rating) <= fsk_rating)

    # Specific streaming provider filter
    if provider_id is not None:
        stmt = stmt.where(Item.provider_id == provider_id)

    # Active household streaming provider filter
    if active_providers_only:
        active_provider_ids = select(ProviderSubscription.id).where(
            ProviderSubscription.household_id == household_id,
            ProviderSubscription.is_active == True,  # noqa: E712
        )
        stmt = stmt.where(col(Item.provider_id).in_(active_provider_ids))

    # Calculate total matching items
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await session.execute(count_stmt)
    total = total_res.scalar_one()

    # Fetch paginated results ordered by creation
    paginated_stmt = stmt.order_by(col(Item.created_at).desc()).offset(skip).limit(limit)
    res = await session.execute(paginated_stmt)
    items = list(res.scalars().all())

    return items, total
