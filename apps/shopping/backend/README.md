# Shopping Checklist Backend (`apps/shopping/backend/`)

FastAPI microservice executing business logic, auto-provisioning system lists, and cataloging sync transactions.

---

## ⚡ Tech Stack

* **Web Framework**: FastAPI (ASGI).
* **ORM & Models**: SQLModel (SQLAlchemy) for DB interactions.
* **Database**: PostgreSQL driver (asyncpg / greenlet).
* **Testing**: Pytest with `aiosqlite` mock databases.
* **Observability**: OpenTelemetry logging integrations.

---

## 🚀 API Endpoints

### 1. Checklist Router (`/api/v1/shopping-lists`)
* `POST /` — Create a new custom shopping list.
* `GET /` — Retrieve all visible shopping lists (ordered by personal → household → custom).
* `PATCH /reorder` — Update display positions index in bulk for custom lists.
* `GET /{list_id}` — Get details and checklist items of a specific list.
* `DELETE /{list_id}` — Delete a list (blocked for system-provisioned lists).
* `POST /{list_id}/items` — Add a manual checklist item.
* `PATCH /{list_id}/items/{item_id}` — Update item details or check-off status.
* `DELETE /{list_id}/items/{item_id}` — Remove item from list.
* `POST /{list_id}/auto-import-low-stock` — Import low-stock pantry alerts.
* `POST /{list_id}/sync-to-pantry` — Push completed checkouts to Pantry inventory.

### 2. External Item Ingress (`/api/v1/shopping/items`)
* `POST /` — Allows Pantry or other external services to push items to the Household list directly.

### 3. User Households (`/api/v1/households`)
* `GET /me` — Retrieves households the authenticated caller belongs to.

---

## 🗄️ Database Models & Schema Invariants

### 1. Table `shopping_lists`
* **`id`** (UUID, Primary Key)
* **`name`** (VARCHAR, display name)
* **`home_id`** (UUID, Indexed) — Scopes list to a household.
* **`owner_id`** (UUID, Indexed) — User creator reference.
* **`is_default`** (BOOLEAN) — True for the shared Household List (max one per `home_id`).
* **`is_personal`** (BOOLEAN) — True for the User Personal List (max one per `owner_id`, follows user across households).
* **`position`** (INTEGER, Default `0`) — Display ordering index.

### 2. Table `shopping_items`
* **`id`** (UUID, PK)
* **`list_id`** (UUID, Foreign Key)
* **`name`** (VARCHAR, item label)
* **`quantity`** (FLOAT, default `1.0`)
* **`unit`** (VARCHAR, measurement unit)
* **`is_completed`** (BOOLEAN, checked state)
* **`is_synced`** (BOOLEAN, synced to Pantry inventory)
* **`product_id`** (UUID, optional) — Matched pantry product.

---

## 🧪 Running Tests & Lint

Run locally using `uv`:
```bash
# Setup virtual environment and install packages
uv venv
uv sync

# Run the complete test suite
uv run pytest

# Check code linting and formatting
uv run ruff check
```
