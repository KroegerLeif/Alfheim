from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Shopping Organizer"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database connection URL (must be an asyncpg URL for async SQLAlchemy)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/shopping"

    # Pantry Backend service integration URL
    PANTRY_BACKEND_URL: str = "http://pantry-backend:8000"

    # Keycloak OIDC Configuration
    KEYCLOAK_URL: str = "http://keycloak:8080/auth"
    KEYCLOAK_PUBLIC_URL: str = "http://api.alfheim.loegien.localhost/auth"
    KEYCLOAK_REALM: str = "alfheim"
    KEYCLOAK_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        if self.KEYCLOAK_JWKS_URL:
            return self.KEYCLOAK_JWKS_URL
        base = self.KEYCLOAK_URL.rstrip("/")
        return f"{base}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def expected_issuer(self) -> str:
        base = self.KEYCLOAK_PUBLIC_URL.rstrip("/")
        return f"{base}/realms/{self.KEYCLOAK_REALM}"

    @property
    def jwks_fallback_urls(self) -> list[str]:
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

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "shopping-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
