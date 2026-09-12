---
title: "Platform Troubleshooting & Operations"
description: "Diagnostic procedures and resolution steps for common operational issues across Caddy ingress, Zitadel OIDC authentication, database connection pools, and."
sidebar:
  label: "Troubleshooting"
---

> **TL;DR:** Diagnostic procedures and resolution steps for common operational issues across Caddy ingress, Zitadel OIDC authentication, database connection pools, and container health.

---

## 📋 Table of Contents
- [Diagnostic Workflow & Cluster Status](#diagnostic-workflow--cluster-status)
- [Caddy Ingress Gateway & Routing Issues](#caddy-ingress-gateway--routing-issues)
- [Zitadel IAM & Token Verification Errors](#zitadel-iam--token-verification-errors)
- [Database Locks & Connection Pool Exhaustion](#database-locks--connection-pool-exhaustion)
- [VictoriaStack Telemetry & Vector Log Buffer Issues](#victoriastack-telemetry--vector-log-buffer-issues)

---

## Diagnostic Workflow & Cluster Status

Before diving into specific service issues, execute the central diagnostic checklist:

### 1. Check Container Health States
```bash
docker compose ps
```
Look for containers reporting `unhealthy` or `restarting`.

### 2. Inspect Central Caddy Reverse Proxy Logs
```bash
docker logs --tail 100 -f alfheim_caddy
```

### 3. Run Automated Diagnostic Helper Script
```bash
./scripts/diagnose-mcp.sh
```

---

## Caddy Ingress Gateway & Routing Issues

### Symptom 1: HTTP 502 Bad Gateway on Microfrontend Path
* **Cause:** The destination frontend container (e.g. `pantry-frontend`) is either starting up or failing its Next.js health check.
* **Resolution:**
  1. Inspect container logs: `docker logs --tail 50 alfheim_pantry_frontend`
  2. Verify network connectivity: `docker exec -it alfheim_caddy curl -I http://pantry-frontend:3000`
  3. Restart frontend: `docker compose restart pantry-frontend`

### Symptom 2: macOS Loopback DNS Reset (`.localhost` Resolution Fails)
* **Cause:** Docker Desktop on macOS occasionally drops bridge network loopback bindings after waking from sleep.
* **Resolution:**
  ```bash
  # Force-reload Caddy routing without downtime
  docker exec -it alfheim_caddy caddy reload --config /etc/caddy/Caddyfile
  ```

---

## Zitadel IAM & Token Verification Errors

### Symptom 1: Microservice Returns `401 Unauthorized` or `Invalid Token Issuer`
* **Cause:** Public issuer URL mismatch between browser access (`http://api.alfheim.loegien.localhost/auth/realms/alfheim`) and internal Docker container verification.
* **Resolution:** Ensure `OIDC_ISSUER_URL` in `.env` is the bare origin of the IAM host (`http://auth.alfheim.loegien.localhost` locally) and matches the issuer the browser is redirected to. Zitadel is served on its own host, not on an `/auth` subpath.

### Symptom 2: Missing `X-Household-ID` Header Error
* **Cause:** Frontend session lacks an active household context selection.
* **Resolution:** Clear local storage key `alfheim_active_household_id` or re-select active household in the header switcher dropdown.

---

## Database Locks & Connection Pool Exhaustion

### Symptom 1: Pytest / FastAPI Reports `asyncpg.exceptions.TooManyConnectionsError`
* **Cause:** Unclosed database connection sessions or leak during asynchronous test loops.
* **Resolution:**
  ```bash
  # Terminate idle PostgreSQL connections
  docker exec -it alfheim_pantry_db psql -U postgres -d pantry -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"
  ```

---

## VictoriaStack Telemetry & Vector Log Buffer Issues

### Symptom 1: Vector Reports Endpoint Connection Timeout (`127.0.0.1:8686`)
* **Cause:** OTel Collector or VictoriaMetrics container restarted without Vector updating its socket binding.
* **Resolution:**
  ```bash
  # Check Vector health endpoint
  curl http://127.0.0.1:8686/health

  # Restart telemetry slice
  docker compose -f infrastructure/telemetry/compose.yml restart vector otel-collector
  ```
