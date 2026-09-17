# backend-shared

Shared Python backend library for Alfheim microservices providing unified S3 object storage utilities, OpenTelemetry instrumentation and logging, and OIDC JWT authentication dependencies.

OIDC discovery and JWKS calls trust the system roots plus any extra root CA named by `ALFHEIM_EXTRA_CA_FILE` (`backend_shared.tls`), which lets backends verify an issuer signed by the installer's local root CA. See the [environment variables reference](../../docs/en/reference/environment-variables.md).
