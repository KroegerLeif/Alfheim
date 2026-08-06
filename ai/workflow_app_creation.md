# Workflow: New App Blueprint & Plan Validation (`ai/workflow_app_creation.md`)

This workflow defines the mandatory two-step validation and execution gate process that AI coding agents must follow before scaffolding or generating code for any new application or major feature in this monorepo.

---

## 🚦 Mandatory Two-Step Process

AI agents **MUST** execute these two steps sequentially. No code generation or directory creation is allowed until Step 2 is complete.

---

## 🔍 Step 1: Plan Validation & Risk Analysis

Before writing any codebase changes, the AI agent must perform a design audit and compile a planning report. This report must be presented to the user as a plan artifact and must cover:

### 1. Architectural Compliance
- Verify that the layout conforms to **Feature-Driven Design (FDD)** boundaries.
- Map the directory structure separating global layers (`src/core/` or `src/shared/`) from domain modules (`src/features/<domain>/`).

### 2. Ingress & Routing Invariant Check
- Map the Traefik router path prefixes to ensure they do not clash with existing monorepo ingress routes.
- Confirm Next.js is designated to handle all internal sub-routing.

### 3. Risk Assessment & Bottlenecks
- Flag potential z-index issues (e.g., if using maps or overlays).
- Analyze data models for potentially null array structures and specify how they will be guarded.
- Highlight Next.js 15+ routing parameter unwrapping requirements.

---

## 🚧 Step 2: Execution Gate (User Approval)

After publishing the planning report and validation summary, the AI agent **MUST** halt operations and wait for explicit feedback.

### 🔒 Gate Constraint:
- Do **NOT** create directories, write files, or modify monorepo configurations.
- The agent must output a clear prompt requesting user review:
  > *Per the monorepo architecture rules, please review the plan and reply with **"APPROVED"** to proceed with implementation.*
- Operations may only resume once the user explicitly replies with **"APPROVED"** in the chat feed.
