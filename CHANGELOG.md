# Changelog

All notable changes to the Alfheim Sovereign OS monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Interactive standalone setup installer (`tools/installer`, binary `alfheim-setup`): a typed Go CLI built on Charm `huh`, following Alfheim's Feature-Driven Design conventions with feature slices for onboarding, security, TLS, templating and bootstrap.
- Root `install.sh` bootstrap that detects the host architecture, downloads the matching release binary, verifies its SHA-256 checksum, and reattaches stdin to `/dev/tty` so `curl … | bash` works with the interactive wizard.
- Four TLS strategies in the installer: Hetzner DNS-01, Cloudflare DNS-01, custom certificates (bundled `./data/caddy/certs/` or a custom absolute host path), and Caddy's internal CA.
- Decoupled two-phase Zitadel bootstrapping: phase 1 starts `postgres-core`, `caddy` and `zitadel`, pauses for the operator to create the initial administrator, then phase 2 starts the application stack.
- Installer CLI flags `--dry-run`, `--non-interactive`, `--reconfigure`, `--install-dir` and `--version`, with an environment-variable equivalent for every configuration flag.
- Custom Caddy image (`infrastructure/caddy/Dockerfile`) built with `xcaddy`, bundling the `caddy-dns/hetzner` and `caddy-dns/cloudflare` ACME DNS providers.
- Root `go.work` Go workspace covering `apps/chat/backend`, `core/dashboard/backend` and `tools/installer`.
- Installer quality gate in `go-ci.yml`: a ≥ 80 % coverage threshold, cross-compilation for `linux/amd64` and `linux/arm64`, and a headless dry-run smoke test.
- Release pipeline now builds, checksums and publishes the static installer binaries alongside the existing production artefacts.
- ADR 0004 (Standalone Interactive Installer as a Typed Go TUI).
- Diátaxis documentation: `tutorials/first-run.md`, `how-to/hetzner-dns-tls.md`, `how-to/custom-certificates.md` and `reference/installer-cli.md`.
- Centralized Diátaxis documentation framework under `/docs/` (`tutorials/`, `how-to/`, `reference/`, `explanation/`).
- MADR Architectural Decision Records framework (`docs/decisions/`), adding ADR 0001 (Diátaxis Adoption) and ADR 0002 (Feature-Driven Design).
- Central Application Catalog (`docs/reference/apps-catalog.md`) covering all Tier-1 Core microservices and Tier-2 Stack applications.
- Master Environment Variables reference (`docs/reference/environment-variables.md`) and Caddy Ingress Matrix (`docs/reference/ingress-matrix.md`).
- Central Known Issues & System Trade-Offs register (`docs/known-issues.md`).

### Changed
- The Caddy ingress gateway is now a custom image built from `infrastructure/caddy/Dockerfile` instead of the upstream `caddy:2-alpine`, which ships no ACME DNS provider modules.
- Root `README.md` quickstart now points at the new root `install.sh`.
- Migrated `INSTALL.md` to `docs/how-to/homelab-deployment.md`.
- Migrated `DEPLOYMENT.md` to `docs/how-to/secrets-hardening.md`.
- Updated root `README.md` to point to central `/docs/` guides.

### Deprecated
- `scripts/install.sh` still orchestrates Keycloak, which ADR 0003 replaced with Zitadel. It now prints a deprecation notice and will be removed in a future release; use the root `install.sh` instead.

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
