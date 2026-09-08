# Changelog

All notable changes to the Alfheim Sovereign OS monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Centralized Diátaxis documentation framework under `/docs/` (`tutorials/`, `how-to/`, `reference/`, `explanation/`).
- MADR Architectural Decision Records framework (`docs/decisions/`), adding ADR 0001 (Diátaxis Adoption) and ADR 0002 (Feature-Driven Design).
- Central Application Catalog (`docs/reference/apps-catalog.md`) covering all Tier-1 Core microservices and Tier-2 Stack applications.
- Master Environment Variables reference (`docs/reference/environment-variables.md`) and Caddy Ingress Matrix (`docs/reference/ingress-matrix.md`).
- Central Known Issues & System Trade-Offs register (`docs/known-issues.md`).

### Changed
- Migrated `INSTALL.md` to `docs/how-to/homelab-deployment.md`.
- Migrated `DEPLOYMENT.md` to `docs/how-to/secrets-hardening.md`.
- Updated root `README.md` to point to central `/docs/` guides.

---

## [v0.1.0-beta.1] - 2026-03-01

### Added
- Initial public beta release of Alfheim Sovereign OS.
- 8 Tier-1 Core microservice modules (Pantry, Budget, Chores, Chat, Workout, Library, Maintenance, Shopping).
- Central Go Dashboard control plane with Tier-1 core application registry.
- Keycloak 26 OIDC IAM integration with household multi-tenancy (`X-Household-ID`).
- Central Caddy ingress reverse-proxy gateway routing.
- VictoriaStack observability pipeline (Vector, OTel Collector, VictoriaMetrics, VictoriaLogs, Grafana).
- Automated staged cluster boot orchestrator (`scripts/up.sh`) and verification suite (`scripts/verify.sh`).
