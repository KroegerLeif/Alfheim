from backend_shared.oidc_discovery import resolve_jwks_url
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Workout Tracker"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    # Log every SQL statement (separate from DEBUG: statements may contain personal data)
    SQL_ECHO: bool = False

    # Security: Restrict allowed origins for CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://alfheim.loegien.localhost",
        "http://api.alfheim.loegien.localhost",
    ]

    # Database connection URL (must be an asyncpg URL for async SQLAlchemy)
    DATABASE_URL: str = "postgresql+asyncpg://workout_user:postgres@localhost:5432/alfheim_workout"

    # Generic OIDC Configuration (Zitadel)
    OIDC_ISSUER_URL: str = "http://auth.alfheim.loegien.localhost"
    OIDC_AUDIENCE: str = "alfheim"
    OIDC_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        """Return the OIDC JWKS endpoint URL (explicit override or OIDC discovery, cached per issuer)."""
        return resolve_jwks_url(self.OIDC_ISSUER_URL, self.OIDC_JWKS_URL or None)

    @property
    def expected_issuer(self) -> str:
        return self.OIDC_ISSUER_URL.rstrip("/")

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "workout-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
