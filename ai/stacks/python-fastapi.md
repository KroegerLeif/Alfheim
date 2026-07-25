# Python & FastAPI Architectural Guide (`ai/stacks/python-fastapi.md`)

> **Note for AI Agents**: Always read [ai/CORE.md](file:///Users/leifkroeger/Dev/loeger-os/ai/CORE.md) first.

---

## 1. Overview & Stack Specifications

- **Language / Runtime**: Python 3.12+
- **Frameworks**: FastAPI, FastMCP (Model Context Protocol), SQLAlchemy / SQLModel, Pydantic v2
- **Primary Use Case**: Asynchronous REST Microservices and AI Tool Providers

---

## 2. Mandatory 6-File Feature Module Architecture

All Python microservices must encapsulate domain functionality inside feature modules adhering strictly to the **Mandatory 6-File Structure**:

```text
app/
└── features/
    └── <domain>/
        ├── models.py      # ORM entities & database schemas (SQLAlchemy/SQLModel)
        ├── schemas.py     # Pydantic V2 DTOs (Request / Response validation)
        ├── service.py     # Core business logic & domain service functions
        ├── router.py      # FastAPI REST API endpoint routes
        ├── mcp_tools.py   # FastMCP tool registrations for AI integrations
        └── exceptions.py  # Domain-specific custom exceptions & HTTP error maps
```

### File Responsibilities & Detailed Guidelines:

1. **`models.py`**:
   - Contains database models and ORM mappings (SQLAlchemy / SQLModel).
   - Must not contain HTTP logic, Pydantic schemas, or business rule validation.

2. **`schemas.py`**:
   - Defines strict Pydantic V2 models for incoming payload validation and outgoing response serialization.
   - Separate `Create<Domain>Request`, `Update<Domain>Request`, and `<Domain>Response` schemas.

3. **`service.py`**:
   - Holds all pure business logic, calculations, database queries, and third-party API integrations.
   - Accepts domain entities/Pydantic schemas and database sessions (`AsyncSession`).
   - Completely decoupled from FastAPI requests, headers, or FastMCP tool contexts.

4. **`router.py`**:
   - Defines FastAPI `APIRouter` endpoints.
   - Responsible *only* for HTTP routing, dependency injection (`Depends`), and delegating immediately to `service.py`.

5. **`mcp_tools.py`**:
   - Exposes AI tools using FastMCP decorator declarations (`@mcp.tool()`).
   - Responsible *only* for parsing AI input parameters, calling functions in `service.py`, and returning structured responses.

6. **`exceptions.py`**:
   - Defines custom domain exceptions (e.g., `ItemNotFoundError`, `InsufficientStockError`).
   - Includes exception handler mappings to HTTP status codes for FastAPI integration.

---

## 3. Decoupled Service Layer Rule

> 🚨 **CRITICAL RULE**: REST Routers (`router.py`) and FastMCP tools (`mcp_tools.py`) **MUST** share and execute the exact same business logic defined in `service.py`.

### Architecture Flow:

```text
    ┌──────────────────────┐         ┌──────────────────────┐
    │  FastAPI REST Router │         │    FastMCP Tool      │
    │     (router.py)      │         │   (mcp_tools.py)     │
    └──────────┬───────────┘         └──────────┬───────────┘
               │                                │
               │  Calls shared business logic   │
               └───────────────┬────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Domain Service   │
                    │    (service.py)     │
                    └─────────────────────┘
```

- **Prohibited**: Never write database queries, calculations, or domain validation directly inside `router.py` handlers or `mcp_tools.py` tool functions.
- **Enforcement**: If a REST endpoint and an MCP tool perform the same operation (e.g. `create_item`), both MUST invoke `service.create_item(...)`.

---

## 4. Quality Gate & Compilation Commands

Before finishing any task, AI agents must run the following validation steps:

```bash
# 1. Check Python syntax compilation across all feature modules
python3 -m py_compile app/features/<domain>/*.py

# 2. Run Ruff linter & type checking (if configured)
ruff check app/
mypy app/
```
