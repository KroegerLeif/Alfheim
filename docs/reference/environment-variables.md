# Master Environment Variables Reference (`docs/reference/environment-variables.md`)

> **TL;DR:** Exhaustive reference of environment variables used across Alfheim infrastructure, core services, and microservice applications.

---

## 📋 Table of Contents
- [Root Platform Configuration](#root-platform-configuration)
- [Identity & Access Management (Keycloak)](#identity--access-management-keycloak)
- [Object Storage (RustFS S3)](#object-storage-rustfs-s3)
- [Observability Stack (VictoriaStack & Telemetry)](#observability-stack-victoriastack--telemetry)
- [Microservice Backend Variables](#microservice-backend-variables)
- [Microfrontend Environment Variables](#microfrontend-environment-variables)

---

## Root Platform Configuration

Configured centrally in root `.env` (generated from `.env.example` via `./scripts/init-env.sh`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Deployment environment mode (`development`, `testing`, `production`) |
| `ALFHEIM_BASE_URL` | `http://alfheim.loegien.localhost` | Root public domain for frontend ingress |
| `ALFHEIM_API_BASE_URL` | `http://api.alfheim.loegien.localhost` | Root public domain for API gateway |

---

## Identity & Access Management (Keycloak)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `KEYCLOAK_ADMIN_USER` | `admin` | Keycloak administrative username |
| `KEYCLOAK_ADMIN_PASSWORD` | *(Generated AES-256)* | Keycloak administrative password |
| `KEYCLOAK_URL` | `http://keycloak:8080/auth` | Internal Docker container network Keycloak URL |
| `KEYCLOAK_PUBLIC_URL` | `http://api.alfheim.loegien.localhost/auth` | Public browser-facing Keycloak issuer URL |

---

## Object Storage (RustFS S3)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `S3_ENDPOINT_URL` | `http://rustfs:9000` | S3-compatible object storage endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key ID |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret access key |
| `S3_BUCKET_NAME` | `alfheim-storage` | Default attachments and images bucket |

---

## Observability Stack (VictoriaStack & Telemetry)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OTEL_ENABLED` | `true` | Toggle OpenTelemetry instrumentation in backends |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4317` | OTLP gRPC metrics and trace exporter endpoint |
| `VECTOR_PORT` | `8686` | Vector log collector internal health port |

---

## Microservice Backend Variables

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@pantry-db:5432/pantry` | Async PostgreSQL database connection string |
| `CHAT_ENCRYPTION_KEY` | *(Generated 32-byte base64 key)* | AES-256-GCM key for securing LLM API keys |

---

## Microfrontend Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_PANTRY_API_URL` | `http://api.alfheim.loegien.localhost/pantry/api/v1` | Pantry MFE API gateway endpoint |
| `NEXT_PUBLIC_KEYCLOAK_URL` | `http://api.alfheim.loegien.localhost/auth` | Browser Keycloak authentication URL |
