# Architectural Decision Records (ADR)

> **TL;DR:** Central log of architectural decision records for Alfheim, formatted using [MADR (Markdown Architectural Decision Records)](https://adr.github.io/madr/).

---

## 📋 Architectural Decisions Index

| ADR ID | Title | Status | Date | Decision Summary |
| :--- | :--- | :--- | :--- | :--- |
| [`0000`](./0000-template.md) | MADR Template | Active | 2026-03-01 | Standardized decision record format. |
| [`0001`](./0001-diataxis-documentation.md) | Diátaxis Documentation & App Consolidation | Accepted | 2026-03-01 | Adopt Diátaxis, centralize `/docs/`, consolidate app READMEs. |
| [`0002`](./0002-feature-driven-design.md) | Feature-Driven Design Monorepo Architecture | Accepted | 2026-03-01 | Enforce FDD feature subdirectories and 200 LOC limit. |
| [`0003`](./0003-migrate-from-keycloak-to-zitadel.md) | Migration from Keycloak to Zitadel | Accepted | 2026-03-01 | Adopt Zitadel for identity & AuthN; retain household AuthZ in Alfheim Core. |
| [`0004`](./0004-standalone-go-tui-installer.md) | Standalone Interactive Installer as a Typed Go TUI | Accepted | 2026-09-12 | Adopt a Go + Charm `huh` installer under `tools/installer`; decouple Zitadel bootstrapping into two phases. |
