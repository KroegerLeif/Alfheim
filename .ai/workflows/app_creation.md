# Workflow: New App Blueprint & Plan Validation (`.ai/workflows/app_creation.md`)

This workflow defines the mandatory two-step validation and execution gate process that AI coding agents must follow before scaffolding or generating code for any new application or major feature in this monorepo.

---

## 🚦 Mandatory Two-Step Process

AI agents **MUST** execute these two steps sequentially. No code generation or directory creation is allowed until Step 2 is complete.

---

## 🔍 Step 1: Plan Validation & Risk Analysis

Before writing any codebase changes, the AI agent must perform a design audit and compile a planning report. This report must be presented to the user as a plan artifact and must cover:

### 1. Architectural Compliance
* Verify that the layout conforms to **Feature-Driven Design (FDD)** boundaries.
* Map the directory structure separating global layers (`src/core/` or `src/shared/`) from domain modules (`src/features/<domain>/`).

### 2. Ingress & Routing Invariant Check
* Map Caddyfile route paths (`infrastructure/caddy/Caddyfile`) to ensure they do not clash with existing monorepo ingress routes (Refer to [rules/architecture.md](.ai/rules/architecture.md)).
* Confirm Next.js is designated to handle all internal sub-routing.

### 3. Risk Assessment & Bottlenecks
* Flag potential z-index issues (e.g., if using maps or overlays).
* Analyze data models for potentially null array structures and specify how they will be guarded (Refer to [rules/safety.md](.ai/rules/safety.md)).
* Highlight Next.js 15+ routing parameter unwrapping requirements.

### 4. 3-Tier Application Registration Classification
Determine which tier the new app belongs to:
* **Tier 1 (Core Native App):** Register entry in [`tier1_core_registry.go`](core/dashboard/backend/internal/features/apps/tier1_core_registry.go).
* **Tier 2 (Stack Integration / External Portal):** Add configuration entry to [`deploy/stack-apps.yaml`](deploy/stack-apps.yaml) (with required Keycloak roles).
* **Tier 3 (User Bookmark / Custom Link):** Created at runtime by end-users via `/api/v1/user/links`.

---

## 🚧 Step 2: Execution Gate (User Approval)

After publishing the planning report and validation summary, the AI agent **MUST** halt operations and wait for explicit feedback.

### 🔒 Gate Constraint:
* Do **NOT** create directories, write files, or modify monorepo configurations.
* The agent must output a clear prompt requesting user review:
  > *Per the monorepo architecture rules, please review the plan and reply with **"APPROVED"** to proceed with implementation.*
* Operations may only resume once the user explicitly replies with **"APPROVED"** in the chat feed.
