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
- `scripts/zitadel-bootstrap.sh`, which reconciles the Alfheim project and the Grafana OIDC application through Zitadel's Management API and writes the generated client id and secret back into `.env`. Zitadel ships no admin CLI, so the previous `docker exec`-based client registration had no direct equivalent.
- A first-instance machine user in `infrastructure/compose.yml`, whose personal access token (`ZITADEL_FIRSTINSTANCE_PATPATH`, mounted at `infrastructure/zitadel/machinekey/`) authenticates that provisioning. Local development only; production installs use the installer's two-phase bootstrap.
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
- `ALFHEIM_EXTRA_CA_FILE`: server-side OIDC clients (`backend_shared`, the dashboard and chat Go backends) and Grafana (`GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_CA`) trust an extra PEM root CA on top of the system roots for discovery, JWKS and token calls. `compose.prod.yaml` mounts `./infrastructure/ca` read-only at `/etc/alfheim/ca` for those services and `./infrastructure/caddy/pki` at `/etc/caddy/pki` for Caddy only. Unset keeps library defaults; an unreadable or non-PEM file is an error naming the path.
- How-to guide `trust-local-root-ca.md` (EN and DE): verifying the root CA fingerprint, importing it per OS, browser and mobile device, and the fallback of accepting the warning for both hosts.

- Dashboard launcher tile for the new Tier-1 `core/household` app (slug `household`, path `/household`, icon `home`), visible to every authenticated user.

### Changed
- The dashboard's Profile and Household navigation entries point at `/household/profile` and `/household` with full-page navigation, since the `core/household` app serves them. `/profile` redirects temporarily to `/household/profile`.
- The dashboard backend ignores `X-Household-ID` and `X-Household-Role`. It used to reject requests that sent `X-Household-ID` with a token without a household claim, which Zitadel never issues. The dashboard frontend no longer sends `X-Household-Role`.
- The dashboard backend provisions a minimal `user_profiles` row Just-In-Time on write requests, because `user_preferences` and `user_links` reference it by foreign key.
- `install.sh` resolves releases per channel. `latest` now means the newest *stable* release, so publishing an `-rc`, `-beta` or `-alpha` tag no longer becomes the default download. When no stable release exists the installer stops and names the newest pre-release alongside the commands that would install it, instead of failing on GitHub's 404 from `/releases/latest`. `ALFHEIM_CHANNEL=prerelease` opts into testing builds.
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
- `scripts/up.sh` stage 1 now boots `postgres-core → zitadel → rustfs → caddy`, provisions the Grafana OIDC client through `scripts/zitadel-bootstrap.sh`, and no longer builds the removed IAM theme JAR. It warns when `OIDC_ISSUER_URL` disagrees with `ZITADEL_EXTERNALDOMAIN`, which would otherwise break browser logins silently.
- `scripts/down.sh` stops `zitadel` instead of a service `compose.yaml` no longer defines, so the graceful shutdown order is honoured again.
- `scripts/init-env.sh` now derives `ZITADEL_EXTERNALDOMAIN`, `ZITADEL_EXTERNALPORT` and `ZITADEL_EXTERNALSECURE` from the same base URL as `OIDC_ISSUER_URL`. They were derived independently before, so the issuer and the host Zitadel minted tokens for could disagree, which fails every token validation.
- `scripts/init-env.sh` derives the auth host of a `*.localhost` base URL as `auth.<full host>` rather than `auth.<apex>`. Only the former is a `gateway-net` alias of Caddy, and backends resolve the issuer over Docker DNS at startup.
- Root `README.md` quickstart now points at the new root `install.sh`.
- Migrated `INSTALL.md` to `docs/en/how-to/homelab-deployment.md`.
- Migrated `DEPLOYMENT.md` to `docs/en/how-to/secrets-hardening.md`.
- Updated root `README.md` to point to central `/docs/` guides.

### Removed
- Household, member, invite, contact and profile management from the dashboard (backend features `household`, `profile`, `contact`, the `/api/v1/households*` endpoints including contacts, the `/api/v1/profile*` endpoints, and the `/household` and `/profile` pages). They moved to `core/household`. Dashboard migration `000007_drop_household_tables` drops `households`, `household_members`, `household_invites`, `contacts` and `contact_categories` from `alfheim_dashboard` without migrating their data.
- The dashboard's `HouseholdRoleMiddleware`, which could never run because it required a household claim Zitadel does not issue.
- `resolveKeycloakUrl()` from `@alfheim/shared`. It had no callers and all of its browser fallbacks returned `${origin}/auth`, a Keycloak sub-path that Zitadel does not serve. Use the per-app `resolveOidcIssuer()` helpers, which read `NEXT_PUBLIC_OIDC_ISSUER`.
- `KEYCLOAK_REALM`, which has no Zitadel equivalent; the JWKS URI comes from the discovery document.
- `audit.md` and `backlog-coverage-gates.md`, point-in-time sprint reports with outdated claims. Their open items belong in the issue tracker.
- Dead `build:theme` npm script, which filtered a `@alfheim/keycloak-theme` package that is neither tracked nor a workspace member.
- `scripts/install.sh`, the deprecated installer. It orchestrated the pre-ADR-0003 IAM end to end and downloaded realm and theme assets that no longer exist, so it could not have succeeded. The root `install.sh` and its Go installer replace it (ADR 0004).

### Deprecated
- The `KEYCLOAK_*` environment variable names. `scripts/init-env.sh` migrates them in place for one release; after that, only the `OIDC_*` names are read.

### Fixed
- `alfheim-setup --tls internal` now serves HTTPS. It used to render `http://` URLs, `ZITADEL_EXTERNALSECURE=false` and plain-HTTP Caddy sites, and browsers disable `crypto.subtle` outside a secure context, so the PKCE login in every frontend crashed on a real hostname. The installer generates an ECDSA P-256 root CA once (`infrastructure/caddy/pki/root.{crt,key}`, public copy `infrastructure/ca/alfheim-root-ca.crt`, never rotated silently) and Caddy signs every site with it. `.env` gains `ALFHEIM_EXTRA_CA_FILE` (`/etc/alfheim/ca/alfheim-root-ca.crt` for `internal`, empty otherwise), and the install summary prints the root's path, its SHA-256 fingerprint and how to trust it. The LAN `.localhost` preset is HTTPS too.
- Installer Zitadel provisioning (and `alfheim-setup provision`, used by `scripts/up.sh`) talks to a secure install as `https://<auth host>` on Caddy's loopback listener `127.0.0.1:443`. Before, it would have received Caddy's HTTP-to-HTTPS redirect, and following it goes through public DNS and drops the bearer token. It verifies against the system roots plus the generated root, never follows redirects, and gains `--zitadel-tls-addr` and `--ca-file`.
- `alfheim-setup --reconfigure` restarts Caddy after the Edge & Identity phase, so a regenerated Caddyfile takes effect before provisioning. An existing plain-HTTP `internal` install migrates with `--reconfigure`, which also re-provisions the OIDC redirect URIs as `https://`; a plain update warns until that has happened.
- Frontends opened over plain `http://` on a host other than `localhost` show *Secure connection (HTTPS) required* with a link to the same page over `https://`. Before, browsers disabled `crypto.subtle`, PKCE threw on `digest` and the page claimed the identity provider was unreachable.
- When OIDC discovery to an `https` issuer on another host fails without an HTTP response, frontends show *Sign-in service not reachable* with a link to the issuer's discovery URL, instead of a bare "Failed to fetch". On `internal` TLS installs this usually means the auth host's certificate has not been accepted yet.

### Security
- The chat backend no longer takes the household from a client-supplied `X-Household-ID` header when the token carries no household claim. The household comes only from the `household_id` / `active_household_id` claim, and a header without a claim or naming a different household is rejected with `403`, matching the dashboard and Python backends.
- Chat attachments are restricted to their uploader. Migration `000003_add_image_ref_owner` adds `image_refs.owner_user_id`; reading another user's attachment returns `404`, and messages can only link unlinked attachments owned by the conversation owner (`400` otherwise). Attachments uploaded before the migration have no owner and can no longer be read by ID or linked.

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
