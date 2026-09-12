# Central Dashboard Control Plane (`core/dashboard/`)

> **TL;DR:** Central control plane, landing page launcher, application registry, household manager, and telemetry interface for the Alfheim platform.

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
