"""Service for looking up book metadata via Open Library and Google Books APIs."""

import logging
import re

import httpx
from fastapi import HTTPException, status
from src.config import settings
from src.db.models import MediaType
from src.schemas.lookup import BookLookupResponse

logger = logging.getLogger("library.backend.isbn")


async def _fetch_google_books(isbn: str, client: httpx.AsyncClient) -> BookLookupResponse | None:
    """Attempt to fetch book metadata from Google Books API."""
    url = "https://www.googleapis.com/books/v1/volumes"
    params = {"q": f"isbn:{isbn}"}
    if settings.GOOGLE_BOOKS_API_KEY:
        params["key"] = settings.GOOGLE_BOOKS_API_KEY

    try:
        response = await client.get(url, params=params, timeout=10.0)
        if response.status_code != 200:
            return None

        data = response.json()
        items = data.get("items", [])
        if not items:
            return None

        volume_info = items[0].get("volumeInfo", {})
        title = volume_info.get("title")
        if not title:
            return None

        authors = volume_info.get("authors", [])
        author_creator = ", ".join(authors) if authors else None
        description = volume_info.get("description")
        publisher = volume_info.get("publisher")
        published_date = volume_info.get("publishedDate")

        image_links = volume_info.get("imageLinks", {})
        cover_image_url = image_links.get("thumbnail") or image_links.get("smallThumbnail")
        if cover_image_url and cover_image_url.startswith("http://"):
            cover_image_url = cover_image_url.replace("http://", "https://")

        return BookLookupResponse(
            title=title,
            media_type=MediaType.BOOK,
            author_creator=author_creator,
            description=description,
            isbn_gtin=isbn,
            cover_image_url=cover_image_url,
            publisher=publisher,
            published_date=published_date,
        )
    except Exception as exc:
        logger.warning("Google Books lookup failed for ISBN %s: %s", isbn, exc)
        return None


async def _fetch_open_library(isbn: str, client: httpx.AsyncClient) -> BookLookupResponse | None:
    """Attempt to fetch book metadata from Open Library API."""
    bib_key = f"ISBN:{isbn}"
    url = "https://openlibrary.org/api/books"
    params = {
        "bibkeys": bib_key,
        "format": "json",
        "jscmd": "data",
    }

    try:
        response = await client.get(url, params=params, timeout=10.0)
        if response.status_code != 200:
            return None

        data = response.json()
        book_data = data.get(bib_key)
        if not book_data:
            return None

        title = book_data.get("title")
        if not title:
            return None

        authors_list = book_data.get("authors", [])
        author_names = [a.get("name") for a in authors_list if a.get("name")]
        author_creator = ", ".join(author_names) if author_names else None

        publishers_list = book_data.get("publishers", [])
        publisher_names = [p.get("name") for p in publishers_list if p.get("name")]
        publisher = ", ".join(publisher_names) if publisher_names else None

        published_date = book_data.get("publish_date")

        cover_dict = book_data.get("cover", {})
        cover_image_url = cover_dict.get("large") or cover_dict.get("medium") or cover_dict.get("small")

        return BookLookupResponse(
            title=title,
            media_type=MediaType.BOOK,
            author_creator=author_creator,
            description=None,
            isbn_gtin=isbn,
            cover_image_url=cover_image_url,
            publisher=publisher,
            published_date=published_date,
        )
    except Exception as exc:
        logger.warning("Open Library lookup failed for ISBN %s: %s", isbn, exc)
        return None


async def fetch_isbn_metadata(isbn: str) -> BookLookupResponse:
    """Fetch book metadata by ISBN, trying Google Books first, then Open Library.

    Raises:
        HTTPException 400: If ISBN code is invalid.
        HTTPException 404: If no metadata is found for the given ISBN.
        HTTPException 502: If external network connection fails.
    """
    clean_isbn = re.sub(r"[^\dX]", "", isbn.upper())
    if not clean_isbn or len(clean_isbn) not in (10, 13):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ISBN code '{isbn}'. Must be 10 or 13 digits.",
        )

    try:
        async with httpx.AsyncClient() as client:
            # 1. Try Google Books
            result = await _fetch_google_books(clean_isbn, client)
            if result:
                return result

            # 2. Try Open Library
            result = await _fetch_open_library(clean_isbn, client)
            if result:
                return result

    except httpx.HTTPError as exc:
        logger.error("HTTP error during ISBN lookup for %s: %s", clean_isbn, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="External service communication error while fetching ISBN metadata.",
        ) from exc

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No book metadata found for ISBN '{isbn}'.",
    )
