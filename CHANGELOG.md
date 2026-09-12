# Changelog

All notable changes to the Alfheim Sovereign OS monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Astro Starlight documentation portal (`websites/portal`, package `@alfheim/docs-portal`) served at `/docs`, with offline Pagefind full-text search and a Diátaxis sidebar.
- Documentation i18n: English as the default locale, German as a secondary locale. Pages without a German translation are generated from the English source with a translation notice rather than returning 404.
- German translations for all tutorials, how-to guides and explanation pages.
- Per-application reference specifications under `docs/en/reference/apps/`, extracted from the app READMEs.
- ADR 0005 (Astro Starlight Documentation Portal with i18n).
- MIT `LICENSE` file, which the README badge had linked to without it existing.
- `scripts/check-markdown-links.py` and a CI gate that fails the build on broken relative Markdown links.
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
- Diátaxis documentation: `en/tutorials/first-run.md`, `en/how-to/hetzner-dns-tls.md`, `en/how-to/custom-certificates.md` and `en/reference/installer-cli.md`.
- Centralized Diátaxis documentation framework under `/docs/` (`tutorials/`, `how-to/`, `reference/`, `explanation/`), now nested per locale under `docs/en/`.
- MADR Architectural Decision Records framework (`docs/en/explanation/decisions/`), adding ADR 0001 (Diátaxis Adoption) and ADR 0002 (Feature-Driven Design).
- Central Application Catalog (`docs/en/reference/apps-catalog.md`) covering all Tier-1 Core microservices and Tier-2 Stack applications.
- Master Environment Variables reference (`docs/en/reference/environment-variables.md`) and Caddy Ingress Matrix (`docs/en/reference/ingress-matrix.md`).
- Central Known Issues & System Trade-Offs register (`docs/en/explanation/known-issues.md`).

### Changed
- Runtime identity-provider configuration renamed from `KEYCLOAK_*` to `OIDC_*`, completing the runtime side of ADR 0003: `KEYCLOAK_URL`/`KEYCLOAK_BASE_URL` -> `OIDC_INTERNAL_URL`, `KEYCLOAK_PUBLIC_URL`/`KEYCLOAK_PUBLIC_ISSUER` -> `OIDC_ISSUER_URL`, `KEYCLOAK_JWKS_URL` -> `OIDC_JWKS_URL`, `NEXT_PUBLIC_KEYCLOAK_URL` -> `NEXT_PUBLIC_OIDC_ISSUER`. `scripts/init-env.sh` rewrites the old names in a pre-existing `.env`.
- `compose.prod.yaml` no longer defaults any service to `http://keycloak:8080/auth`, a host it does not define. Every backend now receives `OIDC_ISSUER_URL`/`OIDC_AUDIENCE` and every frontend `NEXT_PUBLIC_OIDC_ISSUER`, matching the variables the services actually read.
- `apps/workout/backend` resolves its JWKS URI from the OIDC discovery document instead of falling back to a Keycloak realm path that Zitadel does not serve.
- `backend_shared.decode_keycloak_token` renamed to `decode_oidc_token`; the `decode_token` alias is unchanged.
- Dashboard i18n keys `settings.keycloak_sso` and `settings.keycloak_sso_desc` renamed to `settings.oidc_sso` and `settings.oidc_sso_desc` in all three locales.
- CI pull request gates (`frontend-ci`, `python-ci`, `go-ci`) now also run for pull requests targeting `dev`, so regressions surface before promotion to `main`.
- Documentation corpus moved under `docs/en/`, with ADRs relocated to `docs/en/explanation/decisions/` and the known-issues register to `docs/en/explanation/`. `docs/` remains plain Markdown and stays the single source of truth; the portal loads it through a content collection glob loader.
- App READMEs slimmed to dev quickstarts; their specification content now lives in the reference quadrant.
- `websites/docs` renamed to `websites/landing` (package `@alfheim/landing`), which frees the `docs` package name and reflects that it is the marketing landing page. It gains a `/docs` navigation link.
- `deploy-docs.yml` builds the landing page and the portal, merges the portal into `dist/docs/`, and uploads one Pages artifact. Node moves from 20 to 22 for Astro 7.
- Documentation, component READMEs and the landing page now describe Zitadel rather than Keycloak, completing the documentation side of ADR 0003.
- `secrets-hardening.md` rewritten from a dated readiness audit into a timeless how-to guide. Its remaining checklist moved to the issue tracker, following the same reasoning as the `audit.md` removal.
- The Caddy ingress gateway is now a custom image built from `infrastructure/caddy/Dockerfile` instead of the upstream `caddy:2-alpine`, which ships no ACME DNS provider modules.
- Root `README.md` quickstart now points at the new root `install.sh`.
- Migrated `INSTALL.md` to `docs/en/how-to/homelab-deployment.md`.
- Migrated `DEPLOYMENT.md` to `docs/en/how-to/secrets-hardening.md`.
- Updated root `README.md` to point to central `/docs/` guides.

### Removed
- `resolveKeycloakUrl()` from `@alfheim/shared`. It had no callers and all of its browser fallbacks returned `${origin}/auth`, a Keycloak sub-path that Zitadel does not serve. Use the per-app `resolveOidcIssuer()` helpers, which read `NEXT_PUBLIC_OIDC_ISSUER`.
- `KEYCLOAK_REALM`, which has no Zitadel equivalent; the JWKS URI comes from the discovery document.
- `audit.md` and `backlog-coverage-gates.md`, point-in-time sprint reports with outdated claims. Their open items belong in the issue tracker.
- Dead `build:theme` npm script, which filtered a `@alfheim/keycloak-theme` package that is neither tracked nor a workspace member.

### Deprecated
- The `KEYCLOAK_*` environment variable names. `scripts/init-env.sh` migrates them in place for one release; after that, only the `OIDC_*` names are read.
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
