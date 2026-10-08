# Home Maintenance Tracker Application (`apps/maintenance/`)

> **TL;DR:** Home equipment inventory, recurring maintenance scheduling, interactive service checklists, and historical repair logs for Alfheim.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → Home Maintenance Tracker](../../docs/en/reference/apps/maintenance.md)

---

## 🚀 Local Development & Commands

### 1. Run via Docker Compose
```bash
docker compose up -d
```

### 2. Run Backend Locally
```bash
cd backend
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

### 3. Run Frontend Locally
```bash
cd frontend
pnpm install
pnpm dev
```

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite (with coverage)
cd frontend && npx tsc --noEmit && npx vitest run --coverage
```

Frontend tests render with the real `en`/`de`/`pl` dictionaries from `@alfheim/shared`
(`src/tests/test-utils.tsx`), so an unresolved translation key fails a test.
`src/tests/i18n.test.ts` additionally checks every literal key in all three languages and
rejects hardcoded JSX text. Date logic is tested under negative, zero and positive UTC offsets.
