"""Configuration settings for the Library backend service."""

import logging
import httpx
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Library Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security: Restrict allowed origins for CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://alfheim.loegien.localhost",
        "http://api.alfheim.loegien.localhost",
    ]

    # External Metadata API Keys
    GOOGLE_BOOKS_API_KEY: str | None = None
    TMDB_API_KEY: str | None = None

    # Database connection URL (must be an asyncpg URL for async SQLAlchemy)
    DATABASE_URL: str = "postgresql+asyncpg://library_user:postgres@localhost:5432/alfheim_library"

    # Generic OIDC Configuration (Zitadel)
    OIDC_ISSUER_URL: str = "http://auth.alfheim.loegien.localhost"
    OIDC_AUDIENCE: str = "alfheim"

    @property
    def jwks_url(self) -> str:
        """Return primary OIDC JWKS endpoint URL dynamically discovered from openid-configuration."""
        base = self.OIDC_ISSUER_URL.rstrip("/")
        discovery_url = f"{base}/.well-known/openid-configuration"
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(discovery_url)
                if resp.status_code == 200:
                    data = resp.json()
                    jwks_uri = data.get("jwks_uri")
                    if jwks_uri:
                        return jwks_uri
        except Exception as e:
            logger.debug("Failed to discover JWKS URI from %s: %s", discovery_url, e)
        return f"{base}/keys"

    @property
    def expected_issuer(self) -> str:
        """Return expected JWT issuer URI."""
        return self.OIDC_ISSUER_URL.rstrip("/")

    @property
    def jwks_fallback_urls(self) -> list[str]:
        """Return list of fallback OIDC JWKS endpoint URLs for token verification."""
        urls = [self.jwks_url]
        for base_url in [
            "http://auth.alfheim.loegien.localhost",
            "http://localhost:8080",
            "http://zitadel:8080",
            "https://auth.loegien.de",
        ]:
            url = f"{base_url.rstrip('/')}/keys"
            if url not in urls:
                urls.append(url)
        return urls


settings = Settings()
