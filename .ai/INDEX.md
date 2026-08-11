# AI Agent Router Map (`.ai/INDEX.md`)

This index directs AI agents to the correct guidelines, rules, and workflows depending on their task. 

> [!IMPORTANT]
> **Always read [rules/core.md](file:///Users/leifkroeger/Dev/alfheim/.ai/rules/core.md) and [CONTEXT.md](file:///Users/leifkroeger/Dev/alfheim/.ai/CONTEXT.md) before starting any task.**

---

## 🗺️ What to read when

### 1. General Development
* **First Steps**: Read [CONTEXT.md](file:///Users/leifkroeger/Dev/alfheim/.ai/CONTEXT.md) for the active sprint state, DB invariants, and active apps.
* **Core Rules**: Read [rules/core.md](file:///Users/leifkroeger/Dev/alfheim/.ai/rules/core.md) for general coding style, English comments, Git hygiene, and self-maintaining context rules.

### 2. Creating or Adding Services
* **New Microservice/App**:
  1. Follow [workflows/app_creation.md](file:///Users/leifkroeger/Dev/alfheim/.ai/workflows/app_creation.md) for the plan validation & user approval gate.
  2. Implement according to [blueprints/new_app.md](file:///Users/leifkroeger/Dev/alfheim/.ai/blueprints/new_app.md).
* **New Shared Component**: Consult [blueprints/shared_component.md](file:///Users/leifkroeger/Dev/alfheim/.ai/blueprints/shared_component.md).
* **Adding/Editing Themes**: Consult [blueprints/theme.md](file:///Users/leifkroeger/Dev/alfheim/.ai/blueprints/theme.md).

### 3. Auditing & Refactoring
* **App Architecture Audit**: Follow the checklist in [workflows/audit.md](file:///Users/leifkroeger/Dev/alfheim/.ai/workflows/audit.md).
* **Architectural Boundaries**: Consult [rules/architecture.md](file:///Users/leifkroeger/Dev/alfheim/.ai/rules/architecture.md).
* **Runtime Safety & Guards**: Consult [rules/safety.md](file:///Users/leifkroeger/Dev/alfheim/.ai/rules/safety.md).

### 4. Technology Stacks
Refer to the stack guide matching the active codebase's language/framework:
* **Next.js & Tailwind CSS**: [stacks/nextjs_tailwind.md](file:///Users/leifkroeger/Dev/alfheim/.ai/stacks/nextjs_tailwind.md)
* **Python & FastAPI**: [stacks/python_fastapi.md](file:///Users/leifkroeger/Dev/alfheim/.ai/stacks/python_fastapi.md)
* **Go (Golang)**: [stacks/golang.md](file:///Users/leifkroeger/Dev/alfheim/.ai/stacks/golang.md)
* **Java & Spring Boot**: [stacks/java_spring.md](file:///Users/leifkroeger/Dev/alfheim/.ai/stacks/java_spring.md)
