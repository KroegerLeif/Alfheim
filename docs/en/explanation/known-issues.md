---
title: "Known Issues & System Trade-Offs"
description: "Central register of accepted architectural trade-offs, environmental limitations and known operational costs. Software bugs belong in the issue tracker."
sidebar:
  label: "Known Issues"
---

> **TL;DR:** Central register of accepted architectural trade-offs, environmental limitations, and known operational costs in the Alfheim ecosystem. Software bugs belong in the repository Issue Tracker.

---

## 📋 Accepted Costs & Environmental Trade-Offs

| Subsystem | Symptom / Behavior | Root Cause & Accepted Cost | Workaround / Operational Mitigation |
| :--- | :--- | :--- | :--- |
| **Caddy / macOS** | Loopback DNS resolution fails for `.localhost` subdomains after macOS sleep | macOS Docker Desktop bridge loopback isolation issue | Execute `docker exec -it alfheim_caddy caddy reload --config /etc/caddy/Caddyfile` |
| **Caddy / `internal` TLS** | Browsers show a certificate warning for every Alfheim host, including the LAN `.localhost` preset | Sign-in needs HTTPS (Web Crypto is only available in a secure context), so the `internal` strategy serves HTTPS signed by a private root CA the installer generates. No browser trusts that root by default | Import `infrastructure/ca/alfheim-root-ca.crt` once per device, after checking its fingerprint. See [Trust the local root CA](../how-to/trust-local-root-ca.md) |
| **Browser / `internal` TLS** | Accepting the warning only for the app host leaves sign-in failing with *Sign-in service not reachable* | Browsers store certificate exceptions per host and never show an interstitial for background requests, so the discovery request to the auth host is rejected silently | Import the root CA, or open and accept the warning for **both** the app host and the auth host before signing in |
| **Telemetry / Vector** | 100ms latency buffer on structured log delivery to VictoriaLogs | Async OTLP micro-batching window configured in Vector to minimize container CPU overhead | Real-time unbuffered container logs remain instantly accessible via `docker logs <container>` |
| **Python Workspaces** | Microservices require `context: ../..` build root in Docker Compose | `uv` workspace dependency resolution requires access to root `pyproject.toml` and workspace packages (`packages/backend-shared`) | Docker build context is set to monorepo root in compose files |
| **Household authorization / cache** | A member removed from a household keeps access for up to 30 s; a user who just joined can get `403 household_forbidden` for up to 5 s | Backends cache membership answers from `core/household` per process (members 30 s, non-members 5 s) so that not every request costs an internal call ([ADR 0006](./decisions/0006-household-authorization-via-membership-api.md)) | Wait for the cache window, or restart the affected backend to clear its cache immediately |
| **Household authorization / availability** | Every household-scoped request in every app fails with `503 household_service_unavailable` while `household-backend` is down or `ALFHEIM_INTERNAL_TOKEN` differs between services | Membership is checked online and fails closed; there is no offline fallback | Check `docker compose ps household-backend` and its logs, and make sure every backend gets the same `ALFHEIM_INTERNAL_TOKEN`. See [Troubleshooting](../how-to/troubleshooting.md#symptom-4-503-household_service_unavailable) |
| **Maintenance / UUID households** | `maintenance-backend` refuses to start with `LegacyHouseholdSchemaError` on a database created before the switch to UUID households | Household ids changed from integers to UUIDs. The schema comes from `SQLModel.metadata.create_all`, which cannot change existing columns, and old rows cannot be mapped to real households | Drop the maintenance tables once; existing maintenance data is discarded. See [Troubleshooting](../how-to/troubleshooting.md#symptom-5-maintenance-backend-fails-with-legacyhouseholdschemaerror) |
| **Chat / legacy rows** | Conversations created before household checks existed no longer appear; shared model blocks without a household became private | Migration `000004_household_ids_uuid` casts household ids to UUID and sets non-UUID values to `NULL`. Access fails closed for rows without a verified household | None; start a new conversation and re-share the model block from the owner's account |
