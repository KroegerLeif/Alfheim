# Shopping Checklist Application (`apps/shopping/`)

> **TL;DR:** Collaborative household shopping lists, personal private lists, drag-and-drop item reordering, and Digital Pantry stock export synchronization.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → Shopping Checklist](../../docs/en/reference/apps/shopping.md)

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
pnpm dev --port 3010
```

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
