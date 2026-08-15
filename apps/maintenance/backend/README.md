# Maintenance Backend Architecture — HOW (`apps/maintenance/backend/`)

This directory houses the **FastAPI & SQLModel** backend microservice for the `alfheim` Maintenance application. It manages the relational database persistence, schema constraints, Keycloak auth context verification, and exposes Model Context Protocol (MCP) tools.

---

## 📁 Directory Structure & Feature-Driven Design (FDD)

```text
app/
├── core/                 # Shared infrastructure and configuration
│   ├── config.py         # App environment configuration variables
│   ├── database.py       # SQLModel engine initialization & async session yielding
│   ├── dependencies.py   # Keycloak token verification & active household injection
│   ├── mcp.py            # FastMCP server registration
│   └── telemetry.py      # OpenTelemetry instrumentation setup
├── features/             # Business domain sub-packages
│   ├── devices/          # Household and device registry
│   ├── maintenance/      # Service submission orchestration
│   └── tasks/            # Checklist step definitions and immutable history events
└── main.py               # Application entryway & routes registration
```

---

## 🗄️ Database Schema & Invariants

The persistence layer uses a PostgreSQL database named `maintenance`. All models utilize SQLModel subclasses:

### 1. Table: `household`
* `id` (Integer, Primary Key)
* `name` (String, Required)
* `address` (String, Optional)

### 2. Table: `device`
* `id` (Integer, Primary Key)
* `name` (String, Required)
* `model` (String, Required)
* `serial` (String, Required)
* `category` (String, Required)
* `location` (String, Required)
* `status` (String, Active / Maintenance / Inactive)
* `service_interval_months` (Integer, Optional)
* `household_id` (Integer, Foreign Key -> `household.id`)

### 3. Table: `maintenancestep`
* `id` (Integer, Primary Key)
* `title` (String, Required)
* `description` (String, Optional)
* `recurrence` (Integer, Interval in months)
* `supply_item` (String, Optional)
* `supply_needed_date` (String, ISO format)
* `last_completed` (String, ISO format)
* `device_id` (Integer, Foreign Key -> `device.id`)

### 4. Table: `servicehistoryevent`
* `id` (Integer, Primary Key)
* `date` (String, ISO format)
* `performer` (String, User name)
* `notes` (String, Optional)
* `completed_steps` (JSON Column, list of strings)
* `device_id` (Integer, Foreign Key -> `device.id`)

---

## 🔌 Model Context Protocol (MCP) Integration

Each domain feature exposes custom MCP tools for cursor execution tasks:
* **Devices Toolset**: `get_all_devices`, `register_new_device`
* **Tasks Toolset**: `fetch_pending_tasks`, `save_task_notes`
* **Maintenance Toolset**: `trigger_service_checklist`

---

## 🧪 Testing & Code Quality

Run tests and linting locally using `uv`:

```bash
# Sync dependencies
uv sync --all-groups

# Run pytest with code coverage tracking
uv run pytest --cov=app --cov-report=term-missing

# Run Ruff linter
uv run ruff check .

# Check formatting
uv run ruff format --check .

# Auto-format codebase
uv run ruff format .
```
