# Media & Library Hub Application (`apps/library/`)

The **Library App** is the digital media catalog and book/media tracking service for the Alfheim monorepo. It manages household physical books, digital media, reading progress, lending logs, and wishlist items.

---

## 🎯 Purpose & Value Proposition

| Need | Solution |
| :--- | :--- |
| Book & Media Tracking | Unified media item catalog (Books, Movies, Audiobooks) |
| Reading Progress | Reading session logs, page tracking, and completion status |
| Borrowing & Lending | Loan tracker for items lent to friends or borrowed from libraries |
| Wishlist & Recommendations | Household shared wishlist with ISBN/OpenLibrary metadata sync |

---

## 🏗️ Architecture Overview

```
apps/library/
├── backend/          # FastAPI microservice (Media catalog, Loan management, Progress logs)
├── frontend/         # Next.js 16 App Router MFE (Port 3000, routed at /library)
└── compose.yml       # Container orchestration (library-db, library-backend, library-frontend)
```

---

## 🌐 Ingress Routing & Ports

| Service | Internal Port | Host Mapping / Gateway Route | Protocol / Description |
| :--- | :--- | :--- | :--- |
| `library-db` | 5432 | `5438:5432` | PostgreSQL 16 database |
| `library-backend` | 8000 | `/library/api/v1` or `/api/v1/library` | FastAPI REST API |
| `library-frontend` | 3000 | `alfheim.loegien.localhost/library` | Next.js MFE |

---

## 🔑 Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (`postgresql+asyncpg://postgres:postgres@library-db:5432/library`).
- `NEXT_PUBLIC_LIBRARY_API_URL`: Browser API gateway endpoint (`http://api.alfheim.loegien.localhost/api/v1/library`).
- `KEYCLOAK_PUBLIC_URL`: Browser Keycloak auth endpoint (`http://api.alfheim.loegien.localhost/auth`).

---

## 🚀 Local Run & Test Commands

### Docker Compose
```bash
docker compose up -d
```

### Backend Development
```bash
cd apps/library/backend
uv sync
uv run uvicorn src.main:app --reload --port 8000
PYTHONPATH=. uv run pytest --cov
```

### Frontend Development
```bash
cd apps/library/frontend
pnpm install
pnpm dev
pnpm test
```
