"""API router for external metadata lookup endpoints (ISBN, BGG, TMDB)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.api.dependencies import get_current_household_id
from src.schemas.lookup import (
    BoardGameLookupListResponse,
    BookLookupResponse,
    MovieSeriesLookupListResponse,
)
from src.services.external import (
    fetch_bgg_metadata,
    fetch_isbn_metadata,
    fetch_tmdb_metadata,
)

router = APIRouter(prefix="/lookup", tags=["lookup"])


@router.get(
    "/isbn",
    response_model=BookLookupResponse,
    summary="Lookup book metadata by ISBN",
    description="Fetches book metadata from Google Books or Open Library using an ISBN-10 or ISBN-13 code.",
)
async def lookup_isbn(
    isbn: Annotated[str, Query(description="ISBN-10 or ISBN-13 barcode standard code")],
    _household_id: uuid.UUID = Depends(get_current_household_id),
) -> BookLookupResponse:
    """Retrieve book metadata by ISBN code."""
    return await fetch_isbn_metadata(isbn)


@router.get(
    "/bgg",
    response_model=BoardGameLookupListResponse,
    summary="Lookup board game metadata by title query",
    description="Searches BoardGameGeek XML API2 for board games matching the title query.",
)
async def lookup_bgg(
    query: Annotated[str, Query(description="Board game name or search query")],
    _household_id: uuid.UUID = Depends(get_current_household_id),
) -> BoardGameLookupListResponse:
    """Retrieve board game metadata matching the query."""
    return await fetch_bgg_metadata(query)


@router.get(
    "/tmdb",
    response_model=MovieSeriesLookupListResponse,
    summary="Lookup movie or series metadata by title query",
    description="Searches TMDB API for movies and TV series matching the title query.",
)
async def lookup_tmdb(
    query: Annotated[str, Query(description="Movie or TV series name or search query")],
    _household_id: uuid.UUID = Depends(get_current_household_id),
) -> MovieSeriesLookupListResponse:
    """Retrieve movie and TV series metadata matching the query."""
    return await fetch_tmdb_metadata(query)
