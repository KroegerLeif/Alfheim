"""Unit and integration tests for external metadata lookup REST API endpoints."""

import uuid
from collections.abc import AsyncGenerator
from unittest.mock import patch

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from src.api.dependencies import get_current_household_id
from src.api.v1 import router as api_v1_router
from src.config import settings

HOUSEHOLD_ID = uuid.uuid4()


@pytest_asyncio.fixture
async def test_app() -> FastAPI:
    """Create test FastAPI application."""
    app = FastAPI()
    app.include_router(api_v1_router)
    return app


@pytest_asyncio.fixture
async def client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Create AsyncClient bound to test app."""
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://testserver",
    ) as client:
        yield client


def is_internal_url(url: str | httpx.URL) -> bool:
    """Check if the URL target is the local test server."""
    url_str = str(url)
    return url_str.startswith("/") or "testserver" in url_str


# --- ISBN Lookup Tests ---


@pytest.mark.asyncio
async def test_lookup_isbn_google_books_success(client: AsyncClient, test_app: FastAPI):
    """Test successful book lookup via Google Books API."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_ID

    google_books_data = {
        "items": [
            {
                "volumeInfo": {
                    "title": "Design Patterns",
                    "authors": ["Erich Gamma", "Richard Helm"],
                    "description": "Elements of Reusable Object-Oriented Software",
                    "publisher": "Addison-Wesley",
                    "publishedDate": "1994",
                    "imageLinks": {"thumbnail": "http://books.google.com/pattern.jpg"},
                }
            }
        ]
    }

    mock_google = httpx.Response(200, json=google_books_data)
    orig_get = httpx.AsyncClient.get

    async def _mock_get(self, url, **kwargs):
        if is_internal_url(url):
            return await orig_get(self, url, **kwargs)
        return mock_google

    with patch.object(httpx.AsyncClient, "get", new=_mock_get):
        res = await client.get("/api/v1/library/lookup/isbn?isbn=9780201633610")

    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Design Patterns"
    assert data["media_type"] == "BOOK"
    assert data["author_creator"] == "Erich Gamma, Richard Helm"
    assert data["cover_image_url"] == "https://books.google.com/pattern.jpg"


@pytest.mark.asyncio
async def test_lookup_isbn_open_library_fallback(client: AsyncClient, test_app: FastAPI):
    """Test open library fallback when Google Books yields no items."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_ID

    google_empty = httpx.Response(200, json={"items": []})

    open_lib_data = {
        "ISBN:9780201633610": {
            "title": "Clean Code",
            "authors": [{"name": "Robert C. Martin"}],
            "publishers": [{"name": "Prentice Hall"}],
            "publish_date": "2008",
            "cover": {"medium": "https://covers.openlibrary.org/b/id/123-M.jpg"},
        }
    }
    open_lib_resp = httpx.Response(200, json=open_lib_data)
    orig_get = httpx.AsyncClient.get

    async def _mock_get(self, url, **kwargs):
        if is_internal_url(url):
            return await orig_get(self, url, **kwargs)
        if "googleapis.com" in str(url):
            return google_empty
        return open_lib_resp

    with patch.object(httpx.AsyncClient, "get", new=_mock_get):
        res = await client.get("/api/v1/library/lookup/isbn?isbn=9780201633610")

    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Clean Code"
    assert data["author_creator"] == "Robert C. Martin"
    assert data["publisher"] == "Prentice Hall"


@pytest.mark.asyncio
async def test_lookup_isbn_invalid_and_not_found(client: AsyncClient, test_app: FastAPI):
    """Test error handling for invalid ISBN length and non-existent ISBN."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_ID

    # Invalid ISBN length
    res_inv = await client.get("/api/v1/library/lookup/isbn?isbn=123")
    assert res_inv.status_code == 400

    # Non-existent ISBN
    empty_resp = httpx.Response(200, json={})
    orig_get = httpx.AsyncClient.get

    async def _mock_get(self, url, **kwargs):
        if is_internal_url(url):
            return await orig_get(self, url, **kwargs)
        return empty_resp

    with patch.object(httpx.AsyncClient, "get", new=_mock_get):
        res_404 = await client.get("/api/v1/library/lookup/isbn?isbn=9780000000000")

    assert res_404.status_code == 404


# --- BGG Lookup Tests ---


@pytest.mark.asyncio
async def test_lookup_bgg_success(client: AsyncClient, test_app: FastAPI):
    """Test successful board game lookup via BoardGameGeek XML API2."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_ID

    search_xml = b"""<items total="1">
        <item type="boardgame" id="13">
            <name type="primary" value="Catan"/>
        </item>
    </items>"""

    thing_xml = b"""<items>
        <item type="boardgame" id="13">
            <name type="primary" value="Catan"/>
            <description>Settlers of Catan game description.</description>
            <image>https://bgg.com/catan.jpg</image>
            <minplayers value="3"/>
            <maxplayers value="4"/>
            <playingtime value="120"/>
            <link type="boardgamedesigner" value="Klaus Teuber"/>
            <link type="boardgamecategory" value="Strategy"/>
        </item>
    </items>"""

    mock_search = httpx.Response(200, content=search_xml)
    mock_thing = httpx.Response(200, content=thing_xml)
    orig_get = httpx.AsyncClient.get

    async def _mock_get(self, url, **kwargs):
        if is_internal_url(url):
            return await orig_get(self, url, **kwargs)
        if "xmlapi2/search" in str(url):
            return mock_search
        return mock_thing

    with patch.object(httpx.AsyncClient, "get", new=_mock_get):
        res = await client.get("/api/v1/library/lookup/bgg?query=Catan")

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    game = data["results"][0]
    assert game["title"] == "Catan"
    assert game["media_type"] == "GAME"
    assert game["min_players"] == 3
    assert game["max_players"] == 4
    assert game["runtime_minutes"] == 120
    assert game["author_creator"] == "Klaus Teuber"
    assert "Strategy" in game["categories"]


@pytest.mark.asyncio
async def test_lookup_bgg_empty_query_and_no_results(client: AsyncClient, test_app: FastAPI):
    """Test validation and 404 handling for BGG queries."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_ID

    # Empty query
    res_empty = await client.get("/api/v1/library/lookup/bgg?query=   ")
    assert res_empty.status_code == 400

    # Search with no matching items
    no_items_xml = b"""<items total="0"></items>"""
    mock_res = httpx.Response(200, content=no_items_xml)
    orig_get = httpx.AsyncClient.get

    async def _mock_get(self, url, **kwargs):
        if is_internal_url(url):
            return await orig_get(self, url, **kwargs)
        return mock_res

    with patch.object(httpx.AsyncClient, "get", new=_mock_get):
        res_404 = await client.get("/api/v1/library/lookup/bgg?query=NonExistentGame1234")

    assert res_404.status_code == 404


# --- TMDB Lookup Tests ---


@pytest.mark.asyncio
async def test_lookup_tmdb_success_and_missing_key(client: AsyncClient, test_app: FastAPI):
    """Test TMDB lookup with and without configured API key."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_ID

    # Test without TMDB_API_KEY
    with patch.object(settings, "TMDB_API_KEY", None):
        res_nokey = await client.get("/api/v1/library/lookup/tmdb?query=Inception")
        assert res_nokey.status_code == 502

    # Test with TMDB_API_KEY
    tmdb_data = {
        "results": [
            {
                "id": 27205,
                "media_type": "movie",
                "title": "Inception",
                "overview": "A thief who steals corporate secrets through dream-sharing technology.",
                "release_date": "2010-07-15",
                "poster_path": "/edv5CZvWj09upO23fkgA92B380.jpg",
            },
            {
                "id": 1399,
                "media_type": "tv",
                "name": "Game of Thrones",
                "overview": "Seven noble families fight for control of the mythical land of Westeros.",
                "first_air_date": "2011-04-17",
                "poster_path": "/u3bA18P22P21102.jpg",
            },
        ]
    }

    mock_tmdb = httpx.Response(200, json=tmdb_data)
    orig_get = httpx.AsyncClient.get

    async def _mock_get(self, url, **kwargs):
        if is_internal_url(url):
            return await orig_get(self, url, **kwargs)
        return mock_tmdb

    with patch.object(settings, "TMDB_API_KEY", "test-key-123"):
        with patch.object(httpx.AsyncClient, "get", new=_mock_get):
            res = await client.get("/api/v1/library/lookup/tmdb?query=Inception")

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2

    movie = data["results"][0]
    assert movie["title"] == "Inception"
    assert movie["media_type"] == "MOVIE"
    assert movie["release_year"] == 2010
    assert movie["cover_image_url"] == "https://image.tmdb.org/t/p/w500/edv5CZvWj09upO23fkgA92B380.jpg"

    series = data["results"][1]
    assert series["title"] == "Game of Thrones"
    assert series["media_type"] == "SERIES"
    assert series["release_year"] == 2011


@pytest.mark.asyncio
async def test_lookup_auth_enforcement(client: AsyncClient):
    """Verify that lookup endpoints enforce authentication and return 401 when missing token in non-mock env."""
    with patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False):
        res_isbn = await client.get("/api/v1/library/lookup/isbn?isbn=9780201633610")
        assert res_isbn.status_code == 401

        res_bgg = await client.get("/api/v1/library/lookup/bgg?query=Catan")
        assert res_bgg.status_code == 401

        res_tmdb = await client.get("/api/v1/library/lookup/tmdb?query=Inception")
        assert res_tmdb.status_code == 401
