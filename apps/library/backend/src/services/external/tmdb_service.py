"""Service for looking up movie and TV series metadata via TMDB API."""

import logging

import httpx
from fastapi import HTTPException, status
from src.config import settings
from src.db.models import MediaType
from src.schemas.lookup import MovieSeriesLookupListResponse, MovieSeriesLookupResponse

logger = logging.getLogger("library.backend.tmdb")


async def fetch_tmdb_metadata(query: str) -> MovieSeriesLookupListResponse:
    """Search for movies and TV series on TMDB and parse metadata.

    Raises:
        HTTPException 400: If query is empty.
        HTTPException 404: If no results found.
        HTTPException 502: If API key is not configured or external service error occurs.
    """
    clean_query = query.strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'query' cannot be empty.",
        )

    if not settings.TMDB_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="TMDB API key is not configured on the server.",
        )

    url = "https://api.themoviedb.org/3/search/multi"
    params = {
        "api_key": settings.TMDB_API_KEY,
        "query": clean_query,
        "include_adult": "false",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code != 200:
                logger.error("TMDB API returned HTTP %s for query '%s'", response.status_code, clean_query)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to query TMDB external service.",
                )

            data = response.json()
            raw_results = data.get("results", [])
            if not raw_results:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No movies or series found matching query '{clean_query}'.",
                )

            results: list[MovieSeriesLookupResponse] = []
            for item in raw_results:
                media_type_str = item.get("media_type")
                if media_type_str not in ("movie", "tv"):
                    continue

                media_type = MediaType.MOVIE if media_type_str == "movie" else MediaType.SERIES
                tmdb_id = str(item.get("id")) if item.get("id") else None
                title = item.get("title") or item.get("name") or "Unknown Title"
                overview = item.get("overview") or None

                date_str = item.get("release_date") or item.get("first_air_date")
                release_year = None
                if date_str and len(date_str) >= 4 and date_str[:4].isdigit():
                    release_year = int(date_str[:4])

                poster_path = item.get("poster_path")
                cover_image_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None

                results.append(
                    MovieSeriesLookupResponse(
                        id=tmdb_id,
                        title=title,
                        media_type=media_type,
                        author_creator=None,
                        description=overview,
                        runtime_minutes=None,
                        fsk_rating=None,
                        cover_image_url=cover_image_url,
                        release_year=release_year,
                    )
                )

            if not results:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No movies or series found matching query '{clean_query}'.",
                )

            return MovieSeriesLookupListResponse(
                results=results,
                total=len(results),
            )

    except httpx.HTTPError as exc:
        logger.error("HTTP error during TMDB lookup for query '%s': %s", clean_query, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="External service communication error while fetching TMDB metadata.",
        ) from exc
