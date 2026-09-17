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

---

## 🗓️ Planned Changes (Not Accepted Trade-Offs)

Known gaps with a planned fix. They are listed here so operators can recognise the symptom; they are not accepted costs.

| Subsystem | Symptom / Behavior | Cause | Planned Change & Interim Mitigation |
| :--- | :--- | :--- | :--- |
| **Household authorization** | Requests that carry `X-Household-ID` (sent by frontends once a household is selected) are rejected with `403` | Household membership is owned by the dashboard (later a dedicated household app); Zitadel only authenticates. The backends still expect a `household_id` / `active_household_id` claim in the access token, which Zitadel does not issue, so the header can never be confirmed | Backends will resolve membership through the dashboard instead of token claims. Until then, household-scoped requests fail; clearing `alfheim_active_household_id` in the browser stops the header being sent and limits apps to private data |
