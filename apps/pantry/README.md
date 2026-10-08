# Digital Pantry Application (`apps/pantry/`)

> **TL;DR:** Multi-tenant household inventory, stock tracking, expiration alert, and barcode lookup service for Alfheim.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → Digital Pantry](../../docs/en/reference/apps/pantry.md)

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

## 🔌 Behaviour Notes

- The ledger endpoint (`GET /api/v1/inventory/transactions`) filters by product, location, transaction type and `date_from`/`date_to` and pages with `limit`/`offset`; the ledger page and the consumption chart use it.
- Deleting a category, location or product that is still referenced answers `409` with `{"detail": {"code", "message", "item_count"}}` (`category_in_use`, `location_in_use`, `product_in_use`).
- The frontend edits and deletes custom products, locations and categories; global templates and the system location are read-only. The low-stock export reports failed items and retries only those.
- Open: the product nutrition UI (#540) is not built yet.

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
