---
title: "Platform Troubleshooting & Operations"
description: "Diagnostic procedures and resolution steps for common operational issues across Caddy ingress, Zitadel OIDC authentication, household authorization, database connection pools and container health."
sidebar:
  label: "Troubleshooting"
---

> **TL;DR:** Diagnostic procedures and resolution steps for common operational issues across Caddy ingress, Zitadel OIDC authentication, database connection pools, and container health.

---

## 📋 Table of Contents
- [Diagnostic Workflow & Cluster Status](#diagnostic-workflow--cluster-status)
- [Caddy Ingress Gateway & Routing Issues](#caddy-ingress-gateway--routing-issues)
- [Zitadel IAM & Token Verification Errors](#zitadel-iam--token-verification-errors)
- [Household Authorization Errors](#household-authorization-errors)
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
* **Cause:** Public issuer URL mismatch between the origin the browser is redirected to and the issuer the backend verifies against.
* **Resolution:** Ensure `OIDC_ISSUER_URL` in `.env` is the bare origin of the IAM host (`http://auth.alfheim.loegien.localhost` locally) and matches the issuer the browser is redirected to. Zitadel is served on its own host, not on an `/auth` subpath.

### Symptom 2: Dashboard Shows *Secure connection (HTTPS) required*
* **Cause:** The app was opened over plain `http://` on a host other than `localhost`. Browsers disable Web Crypto outside a secure context, and PKCE sign-in needs it.
* **Resolution:** Follow the `https://` link on the page. An installer `internal` install from before that strategy served HTTPS migrates with `alfheim-setup --reconfigure`.

### Symptom 3: Dashboard Shows *Sign-in service not reachable*
* **Cause:** The browser request to the issuer's discovery document on the auth host failed without an HTTP response. On an `internal` TLS install this usually means the auth host's certificate is not trusted yet, because certificate exceptions are stored per host. It also happens when Zitadel is down or the client is offline.
* **Resolution:** Open the link on the page, trust or accept the auth host's certificate, and reload. To avoid this entirely, [trust the local root CA](./trust-local-root-ca.md). Otherwise check `docker compose ps zitadel caddy`.

---

## Household Authorization Errors

Household-scoped backends confirm every `X-Household-ID` with the household app (`core/household`). Errors have the body `{"detail": {"code": "...", "message": "..."}}`; the code tells you which case applies. See [Authentication & Multi-Tenancy](../explanation/authentication-security.md#multi-tenancy-isolation-x-household-id) for the full contract.

### Symptom 1: `400 household_required` or `household_invalid`
* **Cause:** The request carried no `X-Household-ID` header (`household_required`) or a value that is not a UUID (`household_invalid`). In the browser this usually means the app sent a household-scoped request before a household was selected, or a stale non-UUID id (for example an old integer maintenance id) is stored under `alfheim_active_household_id`.
* **Resolution:** Reload the app so `HouseholdGate` can pick a household. If the error persists, clear `alfheim_active_household_id` in local storage and select a household in the header switcher. A user with no household at all sees a card that links to `/household/onboarding` to create or join one. For API clients, send the household's UUID in `X-Household-ID`.

### Symptom 2: `403 household_forbidden`
* **Cause:** The user is authenticated but is not a member of the household named in `X-Household-ID`: they left it, were removed, it was deleted, or the id belongs to another user. A user who joined a few seconds ago can also see this for up to 5 s, because negative answers are cached.
* **Resolution:** Switch to another household in the header switcher (the gate offers switch buttons), or join the household again through an invite. Wait a few seconds after joining. Check membership in the household app at `/household`.

### Symptom 3: `403 household_role_forbidden`
* **Cause:** The user is a member, but the action needs a higher role. For example, toggling an MCP server in chat needs `OWNER` or `ADMIN`. Roles come from `core/household`, never from the token.
* **Resolution:** Ask an owner or admin of the household to perform the action or to change the user's role at `/household/<id>`. Role changes take effect within 30 s.

### Symptom 4: `503 household_service_unavailable`
* **Cause:** The backend could not confirm the membership, so it refused the request instead of failing open. The household app is down or unreachable, timed out, returned 5xx, rejected the internal token (`401`), or `ALFHEIM_INTERNAL_TOKEN` is not set for the calling backend.
* **Resolution:**
  ```bash
  docker compose ps household-backend
  docker compose logs --tail 100 household-backend
  # Look for membership errors in the calling backend, e.g. pantry:
  docker compose logs --tail 100 pantry-backend | grep -i household
  ```
  Make sure `household-backend` is healthy and that every backend receives the same `ALFHEIM_INTERNAL_TOKEN` as `household-backend` (all come from the root `.env`). `HOUSEHOLD_INTERNAL_URL` must resolve from the calling container (default `http://household-backend:8080`). The frontends show a retry message; reload once the service is back.

### Symptom 5: `maintenance-backend` Fails With `LegacyHouseholdSchemaError`
* **Cause:** The maintenance database was created before household ids became UUIDs. The schema is created by `SQLModel.metadata.create_all`, which cannot change existing columns, so the backend refuses to start instead of mixing integer and UUID households.
* **Resolution:** Drop the old tables once. Existing maintenance data is discarded; other apps are not affected. On startup the tables are recreated with UUID households.

  Development (`compose.yaml`):

   ```bash
   docker compose stop maintenance-backend
   docker compose exec postgres-core sh -c 'psql -U "$POSTGRES_USER" -d alfheim_maintenance -c "DROP TABLE IF EXISTS servicehistoryevent, maintenancestep, device, household CASCADE;"'
   docker compose up -d --build maintenance-backend
   ```

  Production (`compose.prod.yaml`; if you customised `MAINTENANCE_POSTGRES_DB`, use that name):

   ```bash
   docker compose -f compose.prod.yaml stop maintenance-backend
   docker compose -f compose.prod.yaml exec postgres-core sh -c 'psql -U "$POSTGRES_USER" -d "${MAINTENANCE_POSTGRES_DB:-alfheim_maintenance}" -c "DROP TABLE IF EXISTS servicehistoryevent, maintenancestep, device, household CASCADE;"'
   docker compose -f compose.prod.yaml up -d maintenance-backend
   ```

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
