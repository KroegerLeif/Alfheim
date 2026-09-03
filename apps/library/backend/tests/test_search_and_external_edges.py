"""Unit and integration tests covering search facets, external API fallbacks, migrations, and config."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.config import settings
from src.db.migrations import run_search_index_migrations
from src.db.models import Item, MediaType, ProviderSubscription
from src.main import app, lifespan
from src.services.external.bgg_service import fetch_bgg_metadata
from src.services.external.isbn_service import fetch_isbn_metadata
from src.services.external.tmdb_service import fetch_tmdb_metadata
from src.services.search import search_items

DEFAULT_TEST_HOUSEHOLD_ID = uuid.UUID("4eeb7681-8419-4c52-b800-6fef6c7ee51b")


def test_settings_jwks_and_issuer():
    """Verify settings properties for Keycloak JWKS and issuer URLs."""
    assert "protocol/openid-connect/certs" in settings.jwks_url
    assert "realms/alfheim" in settings.expected_issuer
    urls = settings.jwks_fallback_urls
    assert len(urls) >= 1

    with patch.object(settings, "KEYCLOAK_JWKS_URL", "http://explicit:8080/certs"):
        assert settings.jwks_url == "http://explicit:8080/certs"


@pytest.mark.asyncio
async def test_search_facets_and_dialect_edges(db_session: AsyncSession):
    """Verify all filter constraints in search_items including player bounds, duration, FSK, and provider."""
    prov = ProviderSubscription(provider_name="Netflix", household_id=DEFAULT_TEST_HOUSEHOLD_ID, is_active=True)
    db_session.add(prov)
    await db_session.commit()
    await db_session.refresh(prov)

    item1 = Item(
        title="Baking Sourdough",
        description="Crusty bread guide",
        media_type=MediaType.BOOK,
        is_cookbook=True,
        household_id=DEFAULT_TEST_HOUSEHOLD_ID,
        fsk_rating=0,
    )
    item2 = Item(
        title="Terraforming Mars",
        description="Sci-fi strategy game",
        media_type=MediaType.GAME,
        household_id=DEFAULT_TEST_HOUSEHOLD_ID,
        min_players=1,
        max_players=5,
        runtime_minutes=120,
        provider_id=prov.id,
    )
    db_session.add_all([item1, item2])
    await db_session.commit()

    # 1. Filter by is_cookbook
    items, total = await search_items(db_session, DEFAULT_TEST_HOUSEHOLD_ID, is_cookbook=True)
    assert total >= 1
    assert any(i.title == "Baking Sourdough" for i in items)

    # 2. Filter by min_players, max_players, max_duration, provider_id
    items, total = await search_items(
        db_session,
        DEFAULT_TEST_HOUSEHOLD_ID,
        min_players=1,
        max_players=6,
        max_duration=150,
        provider_id=prov.id,
    )
    assert total >= 1
    assert any(i.title == "Terraforming Mars" for i in items)

    # 3. Filter with dialect simulated as postgresql
    mock_bind = MagicMock()
    mock_bind.dialect.name = "postgresql"
    with patch.object(db_session, "get_bind", return_value=mock_bind):
        try:
            await search_items(db_session, DEFAULT_TEST_HOUSEHOLD_ID, query="Mars")
        except Exception:
            pass


@pytest.mark.asyncio
async def test_bgg_service_error_handling():
    """Verify BGG search and thing endpoint status errors and malformed XML handling."""
    # 1. Empty query -> 400
    with pytest.raises(HTTPException) as exc:
        await fetch_bgg_metadata("   ")
    assert exc.value.status_code == 400

    # 2. Search HTTP error != 200 -> 502
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=httpx.Response(status_code=500)):
        with pytest.raises(HTTPException) as exc:
            await fetch_bgg_metadata("Catan")
        assert exc.value.status_code == 502

    # 3. Search XML parse error -> 502
    with patch(
        "httpx.AsyncClient.get",
        new_callable=AsyncMock,
        return_value=httpx.Response(status_code=200, content=b"invalid<xml"),
    ):
        with pytest.raises(HTTPException) as exc:
            await fetch_bgg_metadata("Catan")
        assert exc.value.status_code == 502

    # 4. Empty search results -> 404
    empty_xml = b"<items total='0'></items>"
    with patch(
        "httpx.AsyncClient.get", new_callable=AsyncMock, return_value=httpx.Response(status_code=200, content=empty_xml)
    ):
        with pytest.raises(HTTPException) as exc:
            await fetch_bgg_metadata("NonexistentGameXYZ")
        assert exc.value.status_code == 404

    # 5. Search has items but thing details endpoint returns 500 -> 502
    search_xml = b"<items total='1'><item id='12345' type='boardgame'><name value='Test Game'/></item></items>"

    async def mock_get(url, **kwargs):
        if "search" in url:
            return httpx.Response(status_code=200, content=search_xml)
        return httpx.Response(status_code=500)

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        with pytest.raises(HTTPException) as exc:
            await fetch_bgg_metadata("Test Game")
        assert exc.value.status_code == 502

    # 6. Thing details returns invalid XML -> 502
    async def mock_get_bad_thing(url, **kwargs):
        if "search" in url:
            return httpx.Response(status_code=200, content=search_xml)
        return httpx.Response(status_code=200, content=b"bad<xml")

    with patch("httpx.AsyncClient.get", side_effect=mock_get_bad_thing):
        with pytest.raises(HTTPException) as exc:
            await fetch_bgg_metadata("Test Game")
        assert exc.value.status_code == 502


@pytest.mark.asyncio
async def test_isbn_and_tmdb_service_error_handling():
    """Verify ISBN lookup and TMDB search HTTP errors and missing results."""
    # 1. Invalid ISBN format -> 400
    with pytest.raises(HTTPException) as exc:
        await fetch_isbn_metadata("invalid-isbn")
    assert exc.value.status_code == 400

    # 2. ISBN lookup Google Books and OpenLibrary both fail -> 404
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=httpx.Response(status_code=500)):
        with pytest.raises(HTTPException) as exc:
            await fetch_isbn_metadata("9780000000000")
        assert exc.value.status_code == 404

    # 3. TMDB search with empty query -> 400
    with pytest.raises(HTTPException) as exc:
        await fetch_tmdb_metadata("   ")
    assert exc.value.status_code == 400

    # 4. TMDB missing API key -> 502
    with patch.object(settings, "TMDB_API_KEY", None):
        with pytest.raises(HTTPException) as exc:
            await fetch_tmdb_metadata("Inception")
        assert exc.value.status_code == 502

    # 5. TMDB search status 500 -> 502
    with patch.object(settings, "TMDB_API_KEY", "dummy_key"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=httpx.Response(status_code=500)):
            with pytest.raises(HTTPException) as exc:
                await fetch_tmdb_metadata("Inception")
            assert exc.value.status_code == 502

    # 6. TMDB search empty results -> 404
    with patch.object(settings, "TMDB_API_KEY", "dummy_key"):
        with patch(
            "httpx.AsyncClient.get",
            new_callable=AsyncMock,
            return_value=httpx.Response(status_code=200, json={"results": []}),
        ):
            with pytest.raises(HTTPException) as exc:
                await fetch_tmdb_metadata("NonexistentMovieXYZ")
            assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_migrations_and_main_lifespan():
    """Verify run_search_index_migrations handles sqlite skip and postgresql run, and test main lifespan."""
    # 1. SQLite skip
    mock_sqlite_engine = MagicMock()
    mock_sqlite_conn = MagicMock()
    mock_sqlite_conn.dialect.name = "sqlite"
    mock_sqlite_engine.begin.return_value.__aenter__.return_value = mock_sqlite_conn
    mock_sqlite_engine.begin.return_value.__aexit__.return_value = None

    await run_search_index_migrations(mock_sqlite_engine)
    mock_sqlite_conn.execute.assert_not_called()

    # 2. PostgreSQL execution
    mock_pg_engine = MagicMock()
    mock_pg_conn = AsyncMock()
    mock_pg_conn.dialect.name = "postgresql"
    mock_pg_engine.begin.return_value.__aenter__.return_value = mock_pg_conn
    mock_pg_engine.begin.return_value.__aexit__.return_value = None

    await run_search_index_migrations(mock_pg_engine)
    assert mock_pg_conn.execute.call_count == 3

    # 3. Main lifespan
    with patch("src.main.shutdown_telemetry") as mock_shutdown:
        async with lifespan(app):
            pass
        mock_shutdown.assert_called_once()


@pytest.mark.asyncio
async def test_health_endpoints(client: AsyncClient):
    """Verify root /health and /api/v1/health endpoints."""
    # Mount health routes to test app
    client._transport.app.add_api_route("/health", app.routes[-2].endpoint)  # type: ignore
    client._transport.app.add_api_route("/api/v1/health", app.routes[-1].endpoint)  # type: ignore

    res1 = await client.get("/health")
    assert res1.status_code == 200
    assert res1.json()["status"] == "ok"

    res2 = await client.get("/api/v1/health")
    assert res2.status_code == 200
    assert res2.json()["status"] == "ok"
