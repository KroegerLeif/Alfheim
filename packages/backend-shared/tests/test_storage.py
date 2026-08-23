"""Unit tests for backend-shared storage module."""

import pytest
from backend_shared.storage import StorageSettings, get_household_object_key, get_user_object_key


def test_storage_settings_dev_default_fallback(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("S3_ACCESS_KEY", raising=False)
    monkeypatch.delenv("S3_SECRET_KEY", raising=False)

    settings = StorageSettings()
    assert settings.S3_ACCESS_KEY == "minioadmin"
    assert settings.S3_SECRET_KEY == "minioadmin"


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
