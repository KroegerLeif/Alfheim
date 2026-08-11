# Universal Core AI Guidelines (`.ai/rules/core.md`)

This document defines the non-negotiable architectural principles, quality standards, and development practices that apply universally across all repositories, services, and languages in the `alfheim` monorepo.

---

## 1. Feature-Driven Design (FDD)
All codebase architectures must be organized around **business domains (features)** rather than technical layers.
* **Feature Isolation**: Place code relating to a specific domain inside `features/<domain>/` (e.g., `internal/features/<domain>` in Go or `com.alfheim.os.<domain>` in Java).
* **Cohesion & Encapsulation**: A feature module encapsulates its own models, schemas/DTOs, domain logic, data access, and API handlers.
* **Shared Utilities (`shared/` / `core/`)**: Only place code in `shared/` or `core/` if it is strictly domain-agnostic (e.g., HTTP clients, base logger, generic UI primitives). Never put feature-specific business logic in global shared directories.

---

## 2. In-Code Comments & Language Requirements
* **Strict English Rule**: All code comments, docstrings, variable names, function names, types, log messages, and error messages MUST be written strictly in **English**.
* **Self-Documenting Code**: Write expressive, clean, and self-documenting code. Use comments to explain *why* non-obvious design choices were made.
* **API Documentation**: Public functions, classes, interfaces, and API endpoints must include clear, concise comments/docstrings explaining arguments, return values, and exceptions.

---

## 3. Git Hygiene & Conventional Commits
All commit messages must strictly adhere to the Conventional Commits specification in English:
```text
<type>(<scope>): <short summary in imperative mood>

[optional body providing technical details]
```
### Allowed Types:
* `feat`: A new feature for the user or system.
* `fix`: A bug fix.
* `docs`: Documentation changes only.
* `style`: Formatting/styling changes that do not affect code logic.
* `refactor`: Code change that neither fixes a bag nor adds a feature.
* `perf`: Code change that improves performance.
* `test`: Adding missing tests or correcting existing tests.
* `build`: Changes that affect the build system or external dependencies.
* `ci`: Changes to CI configuration scripts and workflows.
* `chore`: Maintenance tasks or updates to auxiliary tools.

---

## 4. Quality Gate & No-Stub Policy
* **No Pass / Dummy Stubs**: Never leave empty functions, empty files, or placeholder stubs (e.g., `pass` in Python, empty block `{}` in JS/Go/Java, or returning mock/hardcoded nulls).
* **No Empty Files**: Do not generate empty placeholder files.
* **Strict Compilation & Build Validation**: Before declaring a task complete, verify that the project compiles cleanly without syntax or type errors (e.g., `pnpm build`, `go build`, `mvn compile`).
* **No Symptom Masking**: Never suppress errors using empty `try/except` blocks, `// @ts-ignore`, or swallowing exceptions silently.

---

## 5. Self-Maintaining Context & Split Commits
* **Automatic Documentation Updates**: Whenever code changes or new apps/features are introduced, the AI agent **MUST** automatically update the local app's `README.md` and `.ai/CONTEXT.md` to reflect the new state, database schemas, feature flags, or endpoints.
* **Separate Commits**: Documentation/Context updates inside `.ai/` and general markdown documentation **MUST** always be committed in a **SEPARATE** Conventional Commit (e.g., `docs(context): update CONTEXT.md and READMEs for <feature>`) immediately following the code implementation commit.
