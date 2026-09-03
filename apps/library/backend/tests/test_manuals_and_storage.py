"""Integration and unit tests for PDF manual upload/delete endpoints and storage service."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.api.v1.manuals import get_manual_storage_service
from src.db.models import Item, MediaType
from src.services.storage import ManualStorageService, build_manual_object_key

DEFAULT_TEST_HOUSEHOLD_ID = uuid.UUID("4eeb7681-8419-4c52-b800-6fef6c7ee51b")


@pytest.mark.asyncio
async def test_manual_endpoints_validation_and_lifecycle(client: AsyncClient, db_session: AsyncSession):
    """Verify upload, URL generation, and deletion edge cases for game manuals."""
    fake_id = uuid.uuid4()

    # 1. Nonexistent item -> 404
    res_no_item = await client.post(
        f"/api/v1/library/items/{fake_id}/manual",
        files={"file": ("rules.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert res_no_item.status_code == 404

    res_no_url = await client.get(f"/api/v1/library/items/{fake_id}/manual/url")
    assert res_no_url.status_code == 404

    res_no_del = await client.delete(f"/api/v1/library/items/{fake_id}/manual")
    assert res_no_del.status_code == 404

    # Create an item
    item = Item(
        title="Catan",
        media_type=MediaType.GAME,
        household_id=DEFAULT_TEST_HOUSEHOLD_ID,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)

    # 2. Upload non-PDF file -> 400
    res_bad_ext = await client.post(
        f"/api/v1/library/items/{item.id}/manual",
        files={"file": ("rules.txt", b"plain text", "text/plain")},
    )
    assert res_bad_ext.status_code == 400
    assert "Only PDF files are allowed" in res_bad_ext.json()["detail"]

    # 3. Upload empty PDF file -> 400
    res_empty = await client.post(
        f"/api/v1/library/items/{item.id}/manual",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert res_empty.status_code == 400
    assert "cannot be empty" in res_empty.json()["detail"]

    # 4. Get URL or delete when no manual uploaded yet -> 404
    assert (await client.get(f"/api/v1/library/items/{item.id}/manual/url")).status_code == 404
    assert (await client.delete(f"/api/v1/library/items/{item.id}/manual")).status_code == 404

    # Mock storage service for successful upload
    mock_storage = MagicMock(spec=ManualStorageService)
    mock_storage.upload_manual = AsyncMock(return_value="s3/key/catan.pdf")
    mock_storage.generate_download_url = AsyncMock(return_value="https://s3.download.url")
    mock_storage.delete_manual = AsyncMock()

    # Override dependency on test app
    client._transport.app.dependency_overrides[get_manual_storage_service] = lambda: mock_storage  # type: ignore

    try:
        # 5. Successful upload
        res_upload = await client.post(
            f"/api/v1/library/items/{item.id}/manual",
            files={"file": ("catan_rules.pdf", b"%PDF-1.4 mock content", "application/pdf")},
        )
        assert res_upload.status_code == 201
        assert res_upload.json()["manual_s3_key"] == "s3/key/catan.pdf"

        # 6. Successful get presigned URL
        res_url = await client.get(f"/api/v1/library/items/{item.id}/manual/url")
        assert res_url.status_code == 200
        assert res_url.json()["download_url"] == "https://s3.download.url"

        # 7. Successful deletion
        res_del = await client.delete(f"/api/v1/library/items/{item.id}/manual")
        assert res_del.status_code == 204

        await db_session.refresh(item)
        assert item.manual_s3_key is None
    finally:
        client._transport.app.dependency_overrides.pop(get_manual_storage_service, None)  # type: ignore


@pytest.mark.asyncio
async def test_manual_storage_service_unit():
    """Verify ManualStorageService methods and S3 key generation."""
    h_id = uuid.uuid4()
    item_id = uuid.uuid4()

    # Verify build_manual_object_key appends .pdf if missing
    key_without_ext = build_manual_object_key(h_id, item_id, "rules")
    assert key_without_ext.endswith("rules.pdf")

    key_with_ext = build_manual_object_key(h_id, item_id, "rules.PDF")
    assert key_with_ext.endswith("rules.PDF")

    # Mock underlying s3_service
    mock_s3 = MagicMock()
    mock_s3.settings.S3_BUCKET_NAME = "test-bucket"
    mock_s3.ensure_bucket_exists = AsyncMock()
    mock_s3.generate_presigned_download_url = AsyncMock(return_value="http://signed-url")

    mock_client = AsyncMock()
    mock_s3._get_client.return_value.__aenter__.return_value = mock_client
    mock_s3._get_client.return_value.__aexit__.return_value = None

    service = ManualStorageService(s3_service=mock_s3)

    # upload_manual
    uploaded_key = await service.upload_manual(h_id, item_id, "rules.pdf", b"bytes")
    assert "rules.pdf" in uploaded_key
    mock_client.put_object.assert_called_once()

    # generate_download_url
    url = await service.generate_download_url(uploaded_key)
    assert url == "http://signed-url"

    # delete_manual
    await service.delete_manual(uploaded_key)
    mock_client.delete_object.assert_called_once()
