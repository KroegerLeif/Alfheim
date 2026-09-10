from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Digital Pantry"
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
    DATABASE_URL: str = "postgresql+asyncpg://pantry_user:postgres@localhost:5432/alfheim_pantry"

    # Generic OIDC Configuration
    OIDC_ISSUER_URL: str = "http://auth.alfheim.loegien.localhost"
    OIDC_AUDIENCE: str = "alfheim"
    OIDC_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        if self.OIDC_JWKS_URL:
            return self.OIDC_JWKS_URL
        base = self.OIDC_ISSUER_URL.rstrip("/")
        return f"{base}/keys"

    @property
    def expected_issuer(self) -> str:
        return self.OIDC_ISSUER_URL.rstrip("/")

    @property
    def jwks_fallback_urls(self) -> list[str]:
        urls = [self.jwks_url]
        base = self.OIDC_ISSUER_URL.rstrip("/")
        for cert_path in [
            "/keys",
            "/oauth/v2/keys",
            "/protocol/openid-connect/certs",
            "/certs",
        ]:
            url = f"{base}{cert_path}"
            if url not in urls:
                urls.append(url)
        return urls

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "pantry-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
