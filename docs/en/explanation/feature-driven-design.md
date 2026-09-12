---
title: "Feature-Driven Design (FDD) Paradigm"
description: "Detailed explanation of the Feature-Driven Design pattern used across Alfheim Python and Go backends, along with the 200 LOC boundary for Next.js frontends."
---

> **TL;DR:** Detailed explanation of the Feature-Driven Design pattern used across Alfheim Python and Go backends, along with the 200 LOC boundary for Next.js frontends.

---

## 📋 Table of Contents
- [Why Feature-Driven Design?](#why-feature-driven-design)
- [Backend FDD Directory Structure](#backend-fdd-directory-structure)
- [Explicit Public Exports (`__init__.py`)](#explicit-public-exports-__init__py)
- [Frontend Architectural LOC Limit (200 Lines)](#frontend-architectural-loc-limit-200-lines)

---

## Why Feature-Driven Design?

Traditional "layer-first" architectures group all controllers into one folder, all database models into another, and all schemas into a third. In a growing codebase, this creates high friction when refactoring or adding a new business capability.

Alfheim adopts **Feature-Driven Design (FDD)**. Code is organized around self-contained domain features (e.g. `locations`, `categories`, `products`, `inventory`). Each feature folder encapsulates its own models, repositories, services, schemas, REST routers, unit tests, and FastMCP AI tools.

---

## Backend FDD Directory Structure

A typical Python backend feature directory under `src/features/<feature>/` contains:

```
src/features/inventory/
├── __init__.py             # Public module interface and explicit exports (__all__)
├── models.py               # SQLModel / SQLAlchemy database entities
├── schemas.py              # Pydantic request & response schemas
├── service.py              # Pure business logic & transactional operations
├── router.py               # FastAPI REST endpoint definitions
├── mcp_tools.py            # FastMCP tools registered on AI agent hub
└── tests/                  # Co-located unit and integration tests
    ├── test_unit.py
    └── test_household_isolation.py
```

---

## Explicit Public Exports (`__init__.py`)

To enforce clean encapsulation (Open-Closed Principle), every feature directory defines explicit public exports using `__all__`:

```python
# src/features/inventory/__init__.py
from .models import InventoryState, InventoryTransaction
from .service import InventoryService

__all__ = [
    "InventoryState",
    "InventoryTransaction",
    "InventoryService",
]
```

Private helper routines inside `service.py` or `router.py` are prefixed with an underscore (`_calculate_batch_delta()`) and are not exported outside the feature module.

---

## Frontend Architectural LOC Limit (200 Lines)

To ensure code maintainability, prevent giant React components, and guarantee readability, **all frontend source files (`.ts` and `.tsx`) across the monorepo are subject to a strict architectural limit of 200 lines of code (LOC)**.

* **Component Decomposition:** Large views must be split into dedicated orchestrators, presentational components, custom TanStack Query hooks, and types.
* **Shared UI Reuse:** Microfrontends import shared primitives (`Button`, `Badge`, `Dialog`, `Progress`, `Table`) and layout wrappers (`AppHeader`) from `@alfheim/shared`.
