---
title: "Environment Variables Reference"
description: "Exhaustive reference of environment variables used across Alfheim infrastructure, core services, and microservice applications."
sidebar:
  label: "Environment Variables"
---

> **TL;DR:** Exhaustive reference of environment variables used across Alfheim infrastructure, core services, and microservice applications.

---

## 📋 Table of Contents
- [Root Platform Configuration](#root-platform-configuration)
- [Identity & Access Management (Generic OIDC & Zitadel)](#identity--access-management-generic-oidc--zitadel)
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

## Identity & Access Management (Generic OIDC & Zitadel)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Public OIDC issuer: the bare origin of the IAM host |
| `OIDC_INTERNAL_URL` | `http://zitadel:8080` | Internal base URL for server-to-server OIDC calls |
| `OIDC_JWKS_URL` | _(empty)_ | Optional explicit JWKS URL; overrides discovery when set |
| `OIDC_AUDIENCE` | `alfheim-client` | Target OIDC client ID / audience |
| `ZITADEL_MASTER_KEY` | *(Generated 32-byte key)* | Encryption master key for Zitadel initialization |
| `ZITADEL_ADMIN_USER` | `admin` | Zitadel initial administrator username |
| `ZITADEL_ADMIN_PASSWORD` | *(Generated AES-256)* | Zitadel administrative user password |
| `ZITADEL_PORT` | `8080` | Zitadel container internal web service port |

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
| `NEXT_PUBLIC_OIDC_ISSUER` | `http://auth.alfheim.loegien.localhost` | Browser-facing OIDC issuer used by the PKCE flow |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | `alfheim-client` | Client ID for PKCE authorization flow |
