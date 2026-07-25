# [Language / Framework Name] Architectural Guide (`ai/stacks/[stack-name].md`)

> **Note for AI Agents**: Read [ai/CORE.md](file:///Users/leifkroeger/Dev/loeger-os/ai/CORE.md) before implementing code using this stack guide.

---

## 1. Overview & Stack Specifications

- **Language / Version**: [e.g., Python 3.12, TypeScript 5.x, Go 1.22]
- **Primary Framework**: [e.g., FastAPI, Next.js, Spring Boot]
- **Target Use Case**: [e.g., REST Microservices, Frontend Web Apps, Data Processing]

---

## 2. Feature Directory Architecture

Explain the mandatory file/folder layout for feature modules in this stack following Feature-Driven Design (FDD).

```text
src/ (or app/ or internal/)
└── features/
    └── <domain>/
        ├── [file1]
        ├── [file2]
        └── ...
```

### Module Responsibilities:
- List each file/subfolder required within a feature module.
- Detail the exact role and boundaries of each component.

---

## 3. Coding & Naming Conventions

- **File Naming**: [snake_case / camelCase / kebab-case / PascalCase]
- **Type Safety**: [Strict Typing requirements, interfaces, type definitions]
- **Formatting & Linting**: [Rules for formatters, linter configurations]

---

## 4. Service Layer & Decoupling Rules

- Describe how business logic must be isolated in a dedicated service layer.
- Specify how API entry points (REST handlers, GraphQL resolvers, MCP tools, CLI commands) interact with the service layer.
- State strict non-duplication rules.

---

## 5. State Management & Data Fetching (If Applicable)

- HTTP client setup, data fetching patterns, state management standards, or database access layers.

---

## 6. Quality Gate & Compilation Commands

List exact command-line instructions AI agents must run to verify that code compiles cleanly and meets quality gates.

```bash
# Compilation / Build Command
[command]

# Type Checking & Linting Command
[command]
```
