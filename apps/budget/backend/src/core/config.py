from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings for the Budget microservice."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Budget & Treasury Service"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # CORS configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://alfheim.loegien.localhost",
        "http://api.alfheim.loegien.localhost",
    ]

    # Database settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/budget"

    # Keycloak authentication settings
    KEYCLOAK_URL: str = "http://keycloak:8080/auth"
    KEYCLOAK_PUBLIC_URL: str = "http://api.alfheim.loegien.localhost/auth"
    KEYCLOAK_REALM: str = "alfheim"
    KEYCLOAK_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        """Construct JWKS URL from Keycloak settings if not explicitly provided."""
        if self.KEYCLOAK_JWKS_URL:
            return self.KEYCLOAK_JWKS_URL
        base = self.KEYCLOAK_URL.rstrip("/")
        return f"{base}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def expected_issuer(self) -> str:
        """Construct expected token issuer URL."""
        base = self.KEYCLOAK_PUBLIC_URL.rstrip("/")
        return f"{base}/realms/{self.KEYCLOAK_REALM}"


settings = Settings()
