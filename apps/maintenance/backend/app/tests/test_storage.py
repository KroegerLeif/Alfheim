"""Unit tests for StorageSettings validation and environment enforcement."""

import pytest
from app.core.storage import StorageSettings
from pydantic import ValidationError


def test_storage_settings_dev_default_fallback(monkeypatch):
    """Verify that in development environment, missing S3 credentials fall back to default minioadmin."""
    monkeypatch.setenv("ENVIRONMENT", "development")
    settings = StorageSettings()
    assert settings.S3_ACCESS_KEY == "minioadmin"
    assert settings.S3_SECRET_KEY == "minioadmin"


def test_storage_settings_production_missing_access_key(monkeypatch):
    """Verify that in production environment, missing S3_ACCESS_KEY raises a ValidationError."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("S3_ACCESS_KEY", raising=False)
    monkeypatch.setenv("S3_SECRET_KEY", "secretkey123")

    with pytest.raises(ValidationError) as exc_info:
        StorageSettings(S3_ACCESS_KEY=None, S3_SECRET_KEY="secretkey123")
    assert "S3_ACCESS_KEY is required in non-development environment" in str(exc_info.value)


def test_storage_settings_production_missing_secret_key(monkeypatch):
    """Verify that in production environment, missing S3_SECRET_KEY raises a ValidationError."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("S3_ACCESS_KEY", "accesskey123")
    monkeypatch.delenv("S3_SECRET_KEY", raising=False)

    with pytest.raises(ValidationError) as exc_info:
        StorageSettings(S3_ACCESS_KEY="accesskey123", S3_SECRET_KEY=None)
    assert "S3_SECRET_KEY is required in non-development environment" in str(exc_info.value)


def test_storage_settings_production_valid(monkeypatch):
    """Verify that in production environment, providing both credentials succeeds."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    settings = StorageSettings(S3_ACCESS_KEY="prodaccess", S3_SECRET_KEY="prodsecret")
    assert settings.S3_ACCESS_KEY == "prodaccess"
    assert settings.S3_SECRET_KEY == "prodsecret"
