# Media & Library Hub Application (`apps/library/`)

> **TL;DR:** Digital media catalog, book and movie tracking, loan management, reading progress log, and wishlist service for Alfheim.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → Media & Library Hub](../../docs/en/reference/apps/library.md)

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

## 🧭 Behaviour Notes

- Deleting a location or a streaming provider that items still use returns `409`
  (`location_in_use` / `provider_in_use`); the UI explains it and asks the user to move or unlink
  the items first.
- The catalog loads 48 items per page ("load more"); lending records include `item_title`.
- Provider subscriptions use `provider_name` and `provider_type` (`STREAMING`, `GAMING_PASS`,
  `BOOK_PASS`); items link to one through the provider select in the item form.
- Open limitations (lending from the UI, catalog facets) are listed in the
  [reference page](../../docs/en/reference/apps/library.md#known-issues--open-follow-ups).

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
