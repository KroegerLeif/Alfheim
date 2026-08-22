# Python & FastAPI Architectural Guide (`.ai/stacks/python_fastapi.md`)

> **Note for AI Agents**: Always read [.ai/rules/core.md](.ai/rules/core.md) first.

---

## 1. Overview & Stack Specifications

* **Language / Runtime**: Python 3.12+
* **Frameworks**: FastAPI, FastMCP (Model Context Protocol), SQLAlchemy / SQLModel, Pydantic v2
* **Primary Use Case**: Asynchronous REST Microservices and AI Tool Providers

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
   * Contains database models and ORM mappings (SQLAlchemy / SQLModel).
   * Must not contain HTTP logic, Pydantic schemas, or business rule validation.

2. **`schemas.py`**:
   * Defines strict Pydantic V2 models for incoming payload validation and outgoing response serialization.
   * Separate `Create<Domain>Request`, `Update<Domain>Request`, and `<Domain>Response` schemas.

3. **`service.py`**:
   * Holds all pure business logic, calculations, database queries, and third-party API integrations.
   * Accepts domain entities/Pydantic schemas and database sessions (`AsyncSession`).
   * Completely decoupled from FastAPI requests, headers, or FastMCP tool contexts.

4. **`router.py`**:
   * Defines FastAPI `APIRouter` endpoints.
   * Responsible *only* for HTTP routing, dependency injection (`Depends`), and delegating immediately to `service.py`.

5. **`mcp_tools.py`**:
   * Exposes AI tools using FastMCP decorator declarations (`@mcp.tool()`).
   * Responsible *only* for parsing AI input parameters, calling functions in `service.py`, and returning structured responses.

6. **`exceptions.py`**:
   * Defines custom domain exceptions (e.g., `ItemNotFoundError`, `InsufficientStockError`).
   * Includes exception handler mappings to HTTP status codes for FastAPI integration.

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

* **Prohibited**: Never write database queries, calculations, or domain validation directly inside `router.py` handlers or `mcp_tools.py` tool functions.
* **Enforcement**: If a REST endpoint and an MCP tool perform the same operation (e.g. `create_item`), both MUST invoke `service.create_item(...)`.

---

## 4. Quality Gate & Validation Commands

Before finishing any task or submitting a Pull Request, AI agents must run the following validation commands from the repository root:

```bash
# 1. Run centralized Ruff linter & formatter checks
uv run ruff check .
uv run ruff format --check .

# 2. Run static type checking with ty
uv run ty check

# 3. Run all pytest test suites with coverage
uv run pytest --cov

# 4. Run pre-commit hooks
uv run pre-commit run --all-files
```

For complete guidelines on creating a new FastAPI microservice, consult [.ai/guidelines/new-app-scaffolding.md](.ai/guidelines/new-app-scaffolding.md).
