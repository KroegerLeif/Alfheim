"""Unit tests for backend-shared storage module."""

import sys

import pytest
from backend_shared.storage import (
    S3StorageService,
    StorageSettings,
    generate_object_name,
    get_household_object_key,
    get_user_object_key,
    read_bounded_upload,
)
from fastapi import HTTPException


def test_storage_settings_dev_default_fallback(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("S3_ACCESS_KEY", raising=False)
    monkeypatch.delenv("S3_SECRET_KEY", raising=False)

    settings = StorageSettings()
    assert settings.S3_ACCESS_KEY == "minioadmin"
    assert settings.S3_SECRET_KEY == "minioadmin"


@pytest.mark.parametrize("env", [None, "", "production", "staging"])
def test_storage_settings_no_default_credentials_without_explicit_dev(monkeypatch, env):
    """An unset or non-development ENVIRONMENT must never silently fall back to minioadmin."""
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.delitem(sys.modules, "pytest")  # the check treats a loaded pytest as a test context
    if env is None:
        monkeypatch.delenv("ENVIRONMENT", raising=False)
    else:
        monkeypatch.setenv("ENVIRONMENT", env)
    monkeypatch.delenv("S3_ACCESS_KEY", raising=False)
    monkeypatch.delenv("S3_SECRET_KEY", raising=False)

    with pytest.raises(ValueError, match="S3_ACCESS_KEY is required"):
        StorageSettings()


def test_storage_settings_production_missing_access_key(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("S3_ACCESS_KEY", raising=False)
    monkeypatch.setenv("S3_SECRET_KEY", "secret")

    with pytest.raises(ValueError, match="S3_ACCESS_KEY is required"):
        StorageSettings()


def test_storage_settings_production_missing_secret_key(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("S3_ACCESS_KEY", "access")
    monkeypatch.delenv("S3_SECRET_KEY", raising=False)

    with pytest.raises(ValueError, match="S3_SECRET_KEY is required"):
        StorageSettings()


def test_storage_settings_production_valid(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("S3_ACCESS_KEY", "prod_access")
    monkeypatch.setenv("S3_SECRET_KEY", "prod_secret")

    settings = StorageSettings()
    assert settings.S3_ACCESS_KEY == "prod_access"
    assert settings.S3_SECRET_KEY == "prod_secret"


def test_object_key_helpers():
    assert get_household_object_key("hh123", "chores", "/doc.pdf") == "households/hh123/chores/doc.pdf"
    assert get_user_object_key("user456", "pantry", "image.png") == "users/user456/pantry/image.png"


@pytest.mark.asyncio
async def test_presigned_urls_point_at_public_gateway(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    settings = StorageSettings(
        S3_ENDPOINT_URL="http://rustfs:9000",
        S3_PUBLIC_URL="https://alfheim.example.com/storage/",
        S3_ACCESS_KEY="key",
        S3_SECRET_KEY="secret",
        S3_BUCKET_NAME="budget-receipts",
    )
    service = S3StorageService(settings)

    download = await service.generate_presigned_download_url("households/h1/budget/receipts/r.png")

    assert download.startswith(
        "https://alfheim.example.com/storage/budget-receipts/households/h1/budget/receipts/r.png?"
    )
    assert "Signature=" in download


def test_public_url_rewrite_leaves_foreign_urls_untouched(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    service = S3StorageService(
        StorageSettings(S3_ENDPOINT_URL="http://rustfs:9000", S3_PUBLIC_URL="https://alfheim.example.com/storage")
    )

    assert service._to_public_url("http://other:9000/b/k?x=1") == "http://other:9000/b/k?x=1"
    assert service._to_public_url("http://rustfs:9000/b/k?x=1") == "https://alfheim.example.com/storage/b/k?x=1"


class _FakeUpload:
    """Async reader that records how many bytes were requested from the source."""

    def __init__(self, data: bytes) -> None:
        self._data = data
        self.position = 0

    async def read(self, size: int = -1) -> bytes:
        chunk = self._data[self.position : self.position + size]
        self.position += len(chunk)
        return chunk


@pytest.mark.asyncio
async def test_read_bounded_upload_returns_content_within_limit():
    content = b"%PDF-1.7 " + b"x" * 300
    assert await read_bounded_upload(_FakeUpload(content), max_bytes=1024, chunk_size=64) == content


@pytest.mark.asyncio
async def test_read_bounded_upload_stops_after_limit_plus_one_chunk():
    upload = _FakeUpload(b"a" * 100_000)
    with pytest.raises(HTTPException) as exc:
        await read_bounded_upload(upload, max_bytes=1000, chunk_size=256)
    assert exc.value.status_code == 413
    assert upload.position <= 1000 + 256


@pytest.mark.asyncio
async def test_read_bounded_upload_accepts_exactly_the_limit():
    assert len(await read_bounded_upload(_FakeUpload(b"a" * 512), max_bytes=512, chunk_size=100)) == 512


@pytest.mark.asyncio
async def test_read_bounded_upload_rejects_wrong_signature_and_empty():
    with pytest.raises(HTTPException) as bad:
        await read_bounded_upload(_FakeUpload(b"GIF89a"), max_bytes=100, signatures=(b"%PDF-",))
    assert bad.value.status_code == 400
    with pytest.raises(HTTPException) as empty:
        await read_bounded_upload(_FakeUpload(b""), max_bytes=100)
    assert empty.value.status_code == 400


def test_generate_object_name_is_random_and_ignores_client_input():
    first, second = generate_object_name(".PDF"), generate_object_name("pdf")
    assert first.endswith(".pdf") and second.endswith(".pdf")
    assert first != second
    assert len(first) == len("0" * 32 + ".pdf")


@pytest.mark.asyncio
async def test_read_bounded_upload_accept_header_callback():
    ok = await read_bounded_upload(
        _FakeUpload(b"RIFF1234WEBPdata"), max_bytes=100, accept_header=lambda h: h[8:12] == b"WEBP"
    )
    assert ok.startswith(b"RIFF")
    with pytest.raises(HTTPException) as exc:
        await read_bounded_upload(
            _FakeUpload(b"RIFF1234WAVEdata"), max_bytes=100, accept_header=lambda h: h[8:12] == b"WEBP"
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_put_object_writes_to_configured_bucket(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock

    monkeypatch.setenv("ENVIRONMENT", "test")
    service = S3StorageService(StorageSettings(S3_BUCKET_NAME="b"))
    service.ensure_bucket_exists = AsyncMock()  # type: ignore[method-assign]
    client = AsyncMock()
    service._get_client = MagicMock(
        return_value=MagicMock(__aenter__=AsyncMock(return_value=client), __aexit__=AsyncMock(return_value=None))
    )  # type: ignore[method-assign]

    await service.put_object("k.webp", b"data", "image/webp")

    client.put_object.assert_awaited_once_with(Bucket="b", Key="k.webp", Body=b"data", ContentType="image/webp")
