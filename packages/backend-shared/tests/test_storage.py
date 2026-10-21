"""Unit tests for backend-shared storage module."""

import sys

import pytest
from backend_shared.storage import S3StorageService, StorageSettings, get_household_object_key, get_user_object_key


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

    upload = await service.generate_presigned_upload_url(
        "households/h1/budget/receipts/r.png", content_type="image/png"
    )
    download = await service.generate_presigned_download_url("households/h1/budget/receipts/r.png")

    for url in (upload, download):
        assert url.startswith(
            "https://alfheim.example.com/storage/budget-receipts/households/h1/budget/receipts/r.png?"
        )
        assert "Signature=" in url


def test_public_url_rewrite_leaves_foreign_urls_untouched(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    service = S3StorageService(
        StorageSettings(S3_ENDPOINT_URL="http://rustfs:9000", S3_PUBLIC_URL="https://alfheim.example.com/storage")
    )

    assert service._to_public_url("http://other:9000/b/k?x=1") == "http://other:9000/b/k?x=1"
    assert service._to_public_url("http://rustfs:9000/b/k?x=1") == "https://alfheim.example.com/storage/b/k?x=1"
