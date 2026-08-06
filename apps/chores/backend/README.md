# Chores Backend — How the API Works

> **This README answers HOW the backend is implemented.** For the business rationale, see the [app-level README](../README.md).

---

## REST API Endpoints (v1)

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/chores/templates` | Create a new chore template |
| `GET` | `/api/v1/chores/templates` | List all chore templates of the household |
| `GET` | `/api/v1/chores/templates/{id}` | Get a specific chore template |
| `PATCH` | `/api/v1/chores/templates/{id}` | Partially update a chore template |
| `DELETE` | `/api/v1/chores/templates/{id}` | Delete a chore template |
| `GET` | `/api/v1/chores/today` | List chore instances due today (triggers self-healing reset if needed) |
| `POST` | `/api/v1/chores/instances/{id}/assign` | Assign a chore instance to a user |
| `POST` | `/api/v1/chores/instances/{id}/complete` | Mark a chore instance as completed |
| `GET` | `/api/v1/chores/integrations/summary` | Retrieve metrics and streaks summary for dashboard integration |

---

## 1. Directory Structure

The application is structured around **Feature-Driven Design (FDD)** principles, keeping database models, business logic (service), routers, and AI tools self-contained in a domain directory under `src/features/chore_management/`.

```
backend/
├── pyproject.toml              # Dependencies (fastapi, fastmcp, sqlmodel, pydantic-settings)
├── README.md                   # This documentation
├── src/
│   ├── main.py                 # Application entry point & reset background scheduler loop
│   ├── core/                   # Shared system utilities & setup
│   │   ├── config.py           # Environment variables (Pydantic Settings)
│   │   ├── database.py         # SQLAlchemy engine, session maker, DB init
│   │   ├── dependencies.py     # JWT validation and zero-trust household validator
│   │   └── telemetry.py        # OpenTelemetry instrumentations for SigNoz
│   ├── mcp/                    # MCP server core
│   │   └── server.py           # Central FastMCP server and tool discovery engine
│   └── features/               # Independent feature domains
│       └── chore_management/   # Chore management FDD boundary
│           ├── __init__.py     # Module interface
│           ├── models.py       # SQLModel database tables
│           ├── schemas.py      # Pydantic request/response schemas
│           ├── service.py      # Reset engine, completion state machine, & streak updates
│           ├── router.py       # FastAPI HTTP routes
│           ├── mcp_tools.py    # FastMCP tools integration (AI client execution)
│           └── exceptions.py   # Domain exceptions mapping to HTTP errors
```

---

## 2. Invariants & Implementation Details

### A. Non-Cumulative Daily Reset Engine
To prevent chore backlog fatigue, chores follow a `non_cumulative` model:
- Daily at `00:00:05` (local server time), the background scheduler executes a reset:
  - Any uncompleted `ChoreInstance` for the previous day is transitioned to `missed` status.
  - If any chore was missed, the household's streak is reset to `0`.
  - If all chores for the day were completed, the household's streak is incremented.
  - New `pending` instances are generated for the current day.
- **Self-Healing Guard**: If the backend container is offline at midnight, hitting the `/today` endpoint will retroactively evaluate yesterday's results and generate today's chores, guaranteeing streak integrity.

### B. Zero-Trust Household Namespace
All endpoints verify the `X-Household-ID` request header or JWT claims to resolve the user's current household workspace. Data mutations or queries are strictly scoped by this `home_id` to prevent cross-tenant access.

### C. Concurrency Guarding
Streaks are protected against database race conditions during concurrent completions (e.g. multiple family members checking off chores simultaneously) by performing updates inside isolation transactions and applying lock strategies where needed.
