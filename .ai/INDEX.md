# AI Agent Router Map (`.ai/INDEX.md`)

This index directs AI agents to the correct guidelines, rules, and workflows depending on their task.

> [!IMPORTANT]
> **Always read [rules/core.md](.ai/rules/core.md) and [CONTEXT.md](.ai/CONTEXT.md) before starting any task.**

---

## 🗺️ What to read when

### 1. General Development
* **First Steps**: Read [CONTEXT.md](.ai/CONTEXT.md) for the active sprint state, DB invariants, and active apps.
* **Core Rules**: Read [rules/core.md](.ai/rules/core.md) for general coding style, English comments, Git hygiene, and self-maintaining context rules.

### 2. Creating or Adding Services
* **New Microservice/App**:
  1. Follow [workflows/app_creation.md](.ai/workflows/app_creation.md) for the plan validation & user approval gate.
  2. Implement backend according to [guidelines/new-app-scaffolding.md](.ai/guidelines/new-app-scaffolding.md).
  3. Implement frontend and ingress routing according to [blueprints/new_app.md](.ai/blueprints/new_app.md).
* **New Shared Component**: Consult [blueprints/shared_component.md](.ai/blueprints/shared_component.md).
* **Adding/Editing Themes**: Consult [blueprints/theme.md](.ai/blueprints/theme.md).

### 3. Auditing & Refactoring
* **App Architecture Audit**: Follow the checklist in [workflows/audit.md](.ai/workflows/audit.md).
* **Architectural Boundaries**: Consult [rules/architecture.md](.ai/rules/architecture.md).
* **Runtime Safety & Guards**: Consult [rules/safety.md](.ai/rules/safety.md).

### 4. Technology Stacks
Refer to the stack guide matching the active codebase's language/framework:
* **Next.js & Tailwind CSS**: [stacks/nextjs_tailwind.md](.ai/stacks/nextjs_tailwind.md)
* **Python & FastAPI**: [stacks/python_fastapi.md](.ai/stacks/python_fastapi.md)
* **Go (Golang)**: [stacks/golang.md](.ai/stacks/golang.md)

### 5. Quality Gates & Verification
* **Mandatory Pre-Commit Verification**: Follow [guidelines/quality-gates.md](.ai/guidelines/quality-gates.md).
* **Local Verification Runner**: Always run [`./scripts/verify.sh`](scripts/verify.sh) (or specific flags like `./scripts/verify.sh --frontend`) before proposing diffs, committing, or pushing code.
