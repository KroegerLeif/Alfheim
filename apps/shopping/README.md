# Shopping Checklist Application (`apps/shopping/`)

> **TL;DR:** Collaborative household shopping lists, personal private lists, drag-and-drop list reordering, and Digital Pantry stock export synchronization.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → Shopping Checklist](../../docs/en/reference/apps/shopping.md)

---

## 🔄 Behaviour Notes

- `POST /api/v1/shopping-lists/{id}/sync-to-pantry` accepts an optional `{"item_ids": [...]}` body to retry specific items (used after "Save to catalog" in the Einlagern dialog); retries do not count the purchase in the history again.
- Units picked in the UI are stored as lower-cased codes (`stk`, `fl.`, ...); the backend maps the ones Pantry does not know to Pantry units when it syncs.
- The browser reaches this API at `/shopping/api/v1/...` and Pantry at `/pantry/api/v1/...`.
- Item icons are not stored, so the add form has no icon picker (#511).

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
