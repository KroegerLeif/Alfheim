"""Integration tests for game manual upload, URL generation, and deletion endpoints."""

import io
import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.api.dependencies import get_current_household_id
from src.api.v1 import router as api_v1_router
from src.api.v1.manuals import get_manual_storage_service
from src.db.database import get_db_session

HOUSEHOLD_1 = uuid.uuid4()
HOUSEHOLD_2 = uuid.uuid4()


@pytest_asyncio.fixture
async def test_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create in-memory SQLite engine for tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
def mock_storage_service():
    """Mock ManualStorageService fixture."""
    service = AsyncMock()
    service.upload_manual.side_effect = lambda household_id, item_id, filename, content: (
        f"library/households/{household_id}/manuals/{item_id}/{filename}"
    )
    service.generate_download_url.side_effect = lambda object_key, expires_in=3600: (
        f"http://localhost:9000/alfheim-assets/{object_key}?token=mocked"
    )
    service.delete_manual.return_value = None
    return service


@pytest_asyncio.fixture
async def test_app(test_engine: AsyncEngine, mock_storage_service) -> FastAPI:
    """Create test FastAPI application with db and storage overrides."""
    app = FastAPI()
    app.include_router(api_v1_router)

    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = _get_test_db
    app.dependency_overrides[get_manual_storage_service] = lambda: mock_storage_service
    return app


@pytest_asyncio.fixture
async def client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Create AsyncClient bound to test app."""
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://testserver",
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_upload_and_get_manual_url_and_delete(client: AsyncClient, test_app: FastAPI):
    """Test PDF manual upload, presigned URL retrieval, and deletion workflow."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # 1. Create a game item
    item_resp = await client.post(
        "/api/v1/library/items",
        json={
            "title": "Catan Board Game",
            "media_type": "GAME",
            "min_players": 3,
            "max_players": 4,
        },
    )
    assert item_resp.status_code == 201
    item_id = item_resp.json()["id"]

    # 2. Upload valid PDF manual
    pdf_bytes = b"%PDF-1.4 mock pdf manual content..."
    upload_resp = await client.post(
        f"/api/v1/library/items/{item_id}/manual",
        files={"file": ("catan_rules.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()
    assert upload_data["item_id"] == item_id
    assert "catan_rules.pdf" in upload_data["manual_s3_key"]

    # 3. Retrieve presigned download URL
    url_resp = await client.get(f"/api/v1/library/items/{item_id}/manual/url")
    assert url_resp.status_code == 200
    url_data = url_resp.json()
    assert url_data["item_id"] == item_id
    assert "catan_rules.pdf" in url_data["download_url"]

    # 4. Delete manual
    del_resp = await client.delete(f"/api/v1/library/items/{item_id}/manual")
    assert del_resp.status_code == 204

    # 5. Subsequent GET url returns 404
    url_resp_after_del = await client.get(f"/api/v1/library/items/{item_id}/manual/url")
    assert url_resp_after_del.status_code == 404


@pytest.mark.asyncio
async def test_upload_manual_invalid_filetype(client: AsyncClient, test_app: FastAPI):
    """Test uploading a non-PDF file is rejected with 400 Bad Request."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    item_resp = await client.post(
        "/api/v1/library/items",
        json={"title": "Test Game", "media_type": "GAME"},
    )
    item_id = item_resp.json()["id"]

    txt_bytes = b"This is not a PDF file."
    upload_resp = await client.post(
        f"/api/v1/library/items/{item_id}/manual",
        files={"file": ("notes.txt", io.BytesIO(txt_bytes), "text/plain")},
    )
    assert upload_resp.status_code == 400
    assert "Only PDF files are allowed" in upload_resp.json()["detail"]


@pytest.mark.asyncio
async def test_upload_manual_empty_file(client: AsyncClient, test_app: FastAPI):
    """Test uploading an empty PDF file is rejected with 400 Bad Request."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    item_resp = await client.post(
        "/api/v1/library/items",
        json={"title": "Test Game", "media_type": "GAME"},
    )
    item_id = item_resp.json()["id"]

    upload_resp = await client.post(
        f"/api/v1/library/items/{item_id}/manual",
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
    )
    assert upload_resp.status_code == 400
    assert "cannot be empty" in upload_resp.json()["detail"]


@pytest.mark.asyncio
async def test_manual_household_isolation(client: AsyncClient, test_app: FastAPI):
    """Test cross-household isolation for uploading and accessing game manuals."""
    # Create item in Household 1
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1
    item_resp = await client.post(
        "/api/v1/library/items",
        json={"title": "Household 1 Game", "media_type": "GAME"},
    )
    item_id = item_resp.json()["id"]

    pdf_bytes = b"%PDF-1.4 manual content"

    # Household 2 attempts to upload manual for Household 1 item -> 404
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2
    upload_b_resp = await client.post(
        f"/api/v1/library/items/{item_id}/manual",
        files={"file": ("manual.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert upload_b_resp.status_code == 404

    # Household 1 uploads manual
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1
    await client.post(
        f"/api/v1/library/items/{item_id}/manual",
        files={"file": ("manual.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )

    # Household 2 attempts to get presigned URL -> 404
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2
    url_b_resp = await client.get(f"/api/v1/library/items/{item_id}/manual/url")
    assert url_b_resp.status_code == 404


@pytest.mark.asyncio
async def test_get_manual_url_no_manual_uploaded(client: AsyncClient, test_app: FastAPI):
    """Test GET manual URL returns 404 when item has no manual uploaded."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    item_resp = await client.post(
        "/api/v1/library/items",
        json={"title": "Game without manual", "media_type": "GAME"},
    )
    item_id = item_resp.json()["id"]

    url_resp = await client.get(f"/api/v1/library/items/{item_id}/manual/url")
    assert url_resp.status_code == 404
    assert "No manual uploaded" in url_resp.json()["detail"]
