"""Configuration settings for the Library backend service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Database connection URL (must be an asyncpg URL for async SQLAlchemy)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/library"

    # Keycloak OIDC Configuration
    KEYCLOAK_URL: str = "http://keycloak:8080/auth"
    KEYCLOAK_PUBLIC_URL: str = "http://api.alfheim.loegien.localhost/auth"
    KEYCLOAK_REALM: str = "alfheim"
    KEYCLOAK_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        """Return primary Keycloak JWKS endpoint URL."""
        if self.KEYCLOAK_JWKS_URL:
            return self.KEYCLOAK_JWKS_URL
        base = self.KEYCLOAK_URL.rstrip("/")
        return f"{base}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def expected_issuer(self) -> str:
        """Return expected JWT issuer URI."""
        base = self.KEYCLOAK_PUBLIC_URL.rstrip("/")
        return f"{base}/realms/{self.KEYCLOAK_REALM}"

    @property
    def jwks_fallback_urls(self) -> list[str]:
        """Return list of fallback Keycloak JWKS endpoint URLs for token verification."""
        urls = [self.jwks_url]
        for base_url in [
            "http://keycloak:8080/auth",
            "http://alfheim_keycloak:8080/auth",
            "http://api.alfheim.loegien.localhost/auth",
            "http://localhost:8080/auth",
        ]:
            url = f"{base_url.rstrip('/')}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"
            if url not in urls:
                urls.append(url)
        return urls


settings = Settings()
