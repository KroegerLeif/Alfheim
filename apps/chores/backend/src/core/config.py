from backend_shared.oidc_discovery import resolve_jwks_url
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Chores Tracker"
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
    DATABASE_URL: str = "postgresql+asyncpg://chores_user:postgres@localhost:5432/alfheim_chores"

    # Generic OIDC Configuration
    OIDC_ISSUER_URL: str = "http://localhost:8080"
    OIDC_AUDIENCE: str = "alfheim"
    OIDC_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        """Return the JWKS endpoint: explicit override wins, otherwise OIDC discovery."""
        return resolve_jwks_url(self.OIDC_ISSUER_URL, self.OIDC_JWKS_URL or None)

    @property
    def expected_issuer(self) -> str:
        return self.OIDC_ISSUER_URL.rstrip("/")

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "chores-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
