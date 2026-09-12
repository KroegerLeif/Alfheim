---
title: "ADR 0003: Migration from Keycloak to Zitadel"
description: "Technical Story: Identity Provider RAM Optimization & Startup Acceleration"
sidebar:
  label: "0003 Zitadel Migration"
---

* Status: accepted
* Deciders: Alfheim Core Architecture Team
* Date: 2026-03-01

Technical Story: Identity Provider RAM Optimization & Startup Acceleration

---

## Context and Problem Statement

Alfheim previously utilized Keycloak as its centralized Identity and Access Management (IAM) provider. Running Keycloak on Java/JVM incurs a heavy memory footprint (~1 GB RAM) and extended cold-start boot times due to Liquibase database migrations. On constrained homelab hardware (such as single-board computers and mini PCs), this high memory consumption limits available resources for application microservices and introduces startup ordering delays.

Because Alfheim is pre-v1.0 with zero live production users or legacy identity database migrations, migrating to a lighter IAM solution carries no backward compatibility burden.

---

## Decision Drivers

* **Resource Footprint:** Significantly reduce RAM consumption on homelab hardware.
* **Boot Time & Healthchecks:** Achieve fast container boot times and instant healthchecks for reliable stack bring-up (`scripts/up.sh`).
* **Architectural Separation:** Use Zitadel strictly for global user authentication (AuthN) and identity, while retaining household memberships and multi-tenant authorization (AuthZ) within Alfheim Core/Dashboard.
* **Standardized OIDC:** Standardize on standard generic OIDC Authorization Code Flow with PKCE, eliminating custom identity provider themes and JAR compilation.

---

## Considered Options

* **Option 1: Retain Keycloak 26** — Maintain Java-based Keycloak and attempt JVM memory tuning.
* **Option 2: Migrate to Zitadel** — Replace Keycloak entirely with Zitadel, a lightweight Go-based OIDC identity provider.
* **Option 3: In-House Custom Auth Server** — Implement custom OAuth2/OIDC handling inside Alfheim Core.

---

## Decision Outcome

Chosen option: **Option 2 (Migrate to Zitadel)**, because Zitadel requires less than 150 MB RAM, provides sub-second container healthchecks, and cleanly isolates identity management while allowing Alfheim Core to handle household-level authorization.

### Positive Consequences

* **Substantial RAM Savings:** Lowers identity service memory footprint from ~1 GB to <150 MB RAM.
* **Rapid Stack Bring-Up:** Instant container health checks resolve cold-start ordering race conditions.
* **Cleaner Build Pipeline:** Eliminates custom Keycloak theme compilation (`alfheim-theme.jar`) and Keycloakify workspace dependencies.
* **Generic OIDC Standardization:** Applications consume standardized OIDC PKCE parameters (`OIDC_ISSUER_URL`, `OIDC_AUDIENCE`).

### Negative Consequences & Accepted Costs

* **Configuration Updates:** Requires updating infrastructure manifests, environment variable specifications (`OIDC_*` and `ZITADEL_*`), and documentation.

---

## Pros and Cons of the Options

### Option 1: Retain Keycloak 26

* Good, because Keycloak is a feature-rich, enterprise-proven IAM solution.
* Bad, because ~1 GB RAM overhead is excessive for homelab environments.
* Bad, because slow container startup times cause delays during stack bring-up.

### Option 2: Migrate to Zitadel

* Good, because Go binary execution achieves <150 MB RAM footprint.
* Good, because sub-second startup times ensure fast, deterministic healthchecks.
* Good, because it adheres strictly to generic OIDC PKCE standards without custom Java theme JARs.
* Bad, because environment variables and container definitions require re-mapping.

### Option 3: In-House Custom Auth Server

* Good, because it eliminates external IAM dependencies entirely.
* Bad, because building and maintaining a secure, compliant OIDC server introduces high maintenance overhead and security risk.
