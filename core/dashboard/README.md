# Central Dashboard Control Plane (`core/dashboard/`)

> **TL;DR:** Central control plane, landing page launcher, application registry, and telemetry interface for the Alfheim platform.

> **Note:** Households, members and roles, invites, contacts and the user profile moved to the Tier-1 app `core/household`. The dashboard no longer serves `/api/v1/households*`, `/api/v1/profile*` or the `/household` and `/profile` pages, and it ignores the `X-Household-ID` / `X-Household-Role` headers. It links to the household app via a launcher tile and its navigation.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → Central Dashboard Control Plane](../../docs/en/reference/apps/dashboard.md)

---

## 🚀 Local Development & Commands

### 1. Run via Docker Compose
```bash
docker compose up -d
```

### 2. Run Go Backend Locally
```bash
cd backend
go run cmd/server/main.go
```

### 3. Run Next.js Frontend Locally
```bash
cd frontend
pnpm install
pnpm dev
```

---

## 🧪 Testing & Quality Gates

```bash
# Run Go unit & integration tests with race detector
cd backend && go test -race -cover ./...

# Run Frontend typecheck & tests
cd frontend && pnpm check-types && pnpm test
```
