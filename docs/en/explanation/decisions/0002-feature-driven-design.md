---
title: "ADR 0002: Feature-Driven Design & Bounded Context Monorepo"
description: "Technical Story: Microservice Monorepo Consistency & Feature Modularization"
sidebar:
  label: "0002 Feature-Driven Design"
---

* Status: accepted
* Deciders: Alfheim Core Architecture Team
* Date: 2026-03-01

Technical Story: Microservice Monorepo Consistency & Feature Modularization

---

## Context and Problem Statement

Building a scalable homelab monorepo with multiple microservices (in Python FastAPI, Go, and Next.js) requires strict architectural boundaries to prevent monolithic coupling, spaghetti imports, and oversized source files.

---

## Decision Drivers

* **Domain Isolation:** Ensure each feature domain (e.g. `inventory`, `products`, `locations` in Pantry) manages its own models, services, schemas, and routers.
* **Maintainability & Readability:** Prevent giant monolithic controller or component files.
* **Tenant Security:** Enforce multi-tenancy isolation (`X-Household-ID`) consistently across all backend endpoints and FastMCP AI tools.

---

## Considered Options

* **Option 1: Layer-First Architecture** — Group files by layer (`controllers/`, `models/`, `services/`) across the entire app.
* **Option 2: Feature-Driven Design (FDD) with LOC Limits** — Group code by self-contained domain features (`src/features/<domain>/`) with strict public module exports (`__init__.py`) and an architectural limit of 200 lines of code (LOC) per frontend file.

---

## Decision Outcome

Chosen option: **Option 2**, because FDD aligns perfectly with microservice bounded contexts, makes feature removal or addition trivial, and LOC limits guarantee high code readability.

### Positive Consequences

* **Self-Contained Features:** Feature subdirectories encapsulate database tables, business logic, REST routers, and FastMCP tools.
* **Strict Frontend Quality:** 200 LOC limit prevents bloated React components and forces composition into smaller reusable hooks and primitives.
* **Deterministic Tenant Isolation:** All feature queries join location or household models to enforce multi-tenancy isolation.

### Negative Consequences & Accepted Costs

* **Slight Directory Proliferation:** Creating domain subfolders for smaller features adds folder depth.
