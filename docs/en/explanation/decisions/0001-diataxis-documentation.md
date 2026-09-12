---
title: "ADR 0001: Adoption of Diátaxis Documentation Framework"
description: "Technical Story: Documentation Architecture Audit & Restructuring"
sidebar:
  label: "0001 Diátaxis"
---

* Status: accepted
* Deciders: Alfheim Core Architecture Team
* Date: 2026-03-01

Technical Story: Documentation Architecture Audit & Restructuring

---

## Context and Problem Statement

The Alfheim monorepo documentation suffered from structural fragmentation and high maintenance overhead:
1. **Triplicate App READMEs:** Each microservice in `apps/<app>/` maintained three separate documentation files (`apps/<app>/README.md`, `backend/README.md`, and `frontend/README.md`), causing configuration drift regarding ports, environment variables, and gateway routes.
2. **Maintenance Traps:** Manual ASCII directory trees (`tree` Dumps) in Markdown files contained file-level names and estimated lines of code (LOC), rendering documentation stale after minor code refactorings.
3. **Lack of Global Structure:** Central platform architecture concepts (Keycloak OIDC, Caddy path stripping, VictoriaStack telemetry) were scattered across app READMEs without a dedicated, structured global documentation portal.

---

## Decision Drivers

* **Single Source of Truth:** Eliminate duplicate configurations and prevent documentation drift.
* **Maintainability:** Eliminate high-maintenance ASCII file trees and tool-specific legacy files.
* **Developer Onboarding:** Provide clear, structured navigation based on user intent (learning vs. task execution vs. reference lookup).

---

## Considered Options

* **Option 1: Status Quo** — Retain triplicate READMEs per app and unorganized root guides.
* **Option 2: Flat Central Folder** — Move all Markdown files into a single flat `docs/` folder without taxonomy.
* **Option 3: Diátaxis Framework & Consolidated App READMEs** — Organize central documentation into four Diátaxis quadrants (`tutorials/`, `how-to/`, `reference/`, `explanation/`), centralize a master `apps-catalog.md`, and consolidate each app into a single `apps/<app>/README.md`.

---

## Decision Outcome

Chosen option: **Option 3**, because Diátaxis provides an industry-standard framework that clearly separates content by user intent, while consolidating app READMEs ensures single-source-of-truth accuracy for developers and AI agents.

### Positive Consequences

* **Zero Configuration Drift:** Every app has exactly one `apps/<app>/README.md` defining its purpose, ports, environment variables, and local commands.
* **Clear User Navigation:** Diátaxis eliminates confusion by separating beginner walkthroughs from operational how-to guides and technical references.
* **Reduced Maintenance Overhead:** Removing manual ASCII file trees ensures documentation remains valid across refactorings.

### Negative Consequences & Accepted Costs

* **One-Time Migration Effort:** Requires refactoring and consolidating documentation across all 8 microservice applications and core services.

---

## Pros and Cons of the Options

### Option 3 (Diátaxis & Consolidation)

* Good, because it separates content strictly into Tutorials, How-To, Reference, and Explanation.
* Good, because it establishes a central `docs/reference/apps-catalog.md` linking all Tier-1 and Tier-2 applications.
* Bad, because it requires migrating legacy `INSTALL.md` and `DEPLOYMENT.md` files into the new structure.
