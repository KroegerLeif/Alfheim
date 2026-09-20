# Changelog

All notable changes to the Alfheim Sovereign OS monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- How-to guide `dev-test-token.md` (EN and DE): minting an OIDC access token locally with `curl`/`jq` to call an app's API directly, without a browser sign-in.

- `alfheim-setup update [--version vX.Y.Z] [--install-dir DIR] [--yes]`, the one-command Day-2 path: it downloads and checksum-verifies a target release's standalone stack files (`compose.prod.yaml`, the OTel Collector config, `init-multiple-dbs.sh`, `vector.toml`, `scripts/verify-stack.sh`), backs up the previous copies to a timestamped directory, sets `IMAGE_TAG` in `.env`, then reuses the existing Day-2 path (backfill missing secrets, re-provision Zitadel, ensure every service database, `docker compose pull && up -d --remove-orphans`) and runs `scripts/verify-stack.sh` against the result. It never touches an existing secret, the root CA, the Zitadel machinekey/PAT or a Docker volume, and never defaults to `latest` — the target is always an explicit tag or this binary's own release version. `install.sh` grows matching support: `ALFHEIM_UPDATE=1`, a leading `update` argument, or an existing installation with no arguments all hand off to `alfheim-setup update --version <resolved tag>` after downloading that release's binary. A release build's fresh-install default image tag is now its own version rather than `latest` (dev builds keep `latest`).
- `scripts/verify-stack.sh`: checks every Compose service is healthy, Caddy's `/livez`, that OIDC discovery names the configured issuer, every app route resolves through the gateway without a 5xx, `/internal/*` is blocked at the edge, and the household API rejects a request with no bearer token. Works unmodified against `compose.prod.yaml` (a production install) or `compose.yaml` (the local dev stack), auto-detecting whichever is present. Published as a release asset alongside the other standalone stack files.
- Tier-1 household app `core/household`, which takes over households, members and roles, invites, contacts and the user profile from the dashboard. `household-backend` (Go) serves `/api/v1/households*` and `/api/v1/profile*` with the existing JSON shapes, plus rename, delete, transfer ownership, leave, set default, list and revoke invites. Roles are `OWNER`, `ADMIN`, `MEMBER` and `GUEST`; nobody can grant `OWNER` through an invite or a role change, invite redemption is atomic, and the first household a user creates or joins becomes their default. `household-frontend` (Next.js, basePath `/household`) adds scannable invite QR codes, `/household/join?token=…` and `/household/onboarding`.
- Internal membership API `GET /internal/v1/memberships/{householdId}/{userSub}` on `household-backend`, protected by `ALFHEIM_INTERNAL_TOKEN` (constant-time compare) and never routed by Caddy.
- `backend_shared.household`: `require_household`, `require_role`, `HouseholdContext` and a cached membership client (members 30 s, non-members 5 s, errors never cached, 2 s timeout). It validates `X-Household-ID` against the membership API, fails closed with `503 household_service_unavailable`, and uses one error contract (`401 unauthenticated`, `400 household_required` / `household_invalid`, `403 household_forbidden` / `household_role_forbidden`). `MCPAuthenticationMiddleware` applies the same checks to `/mcp`, and `get_mcp_household_context()` gives tools the verified context. `backend_shared.household.testing` adds `override_membership`, `override_household`, `make_test_token` and `mcp_household_context`.
- `@alfheim/shared` household context: `HouseholdProvider`, `useActiveHousehold()`, `HouseholdGate` (onboarding, switch and retry states in EN, DE and PL), `householdHeaders` / `applyHouseholdHeaders` and household error helpers. `HouseholdSwitcher` reads from the provider.
- ADR 0006 (Household Authorization via the Membership API), and a household app reference page (`docs/*/reference/apps/household.md`).
- All seven Python app backends (pantry, shopping, chores, maintenance, budget, workout, library) and `chat-backend` receive `ALFHEIM_INTERNAL_TOKEN` and `HOUSEHOLD_INTERNAL_URL` (default `http://household-backend:8080`) in `compose.prod.yaml` and the dev `apps/*/compose.yml` files, so they can check household membership via the household backend's internal API. Production requires the token. Each consumer reaches `household-backend` over `gateway-net` and waits for it to be healthy.
- Production wiring for the Tier-1 household & roles service (`core/household`): `household-backend` and `household-frontend` in `compose.prod.yaml`, the `alfheim_household` database and `household_user` role in `init-multiple-dbs.sh`, and installer-rendered Caddy routes (`/api/v1/households*` and `/api/v1/profile*` to the backend with the path preserved, `/household*` to the frontend). `/internal/*` now answers `404` on both hosts. The installer generates `HOUSEHOLD_POSTGRES_PASSWORD` and `ALFHEIM_INTERNAL_TOKEN`, registers `<base>/household/` as a redirect and post-logout URI of the shared web client, and waits for both services. The Go CI, govulncheck and release matrices build and publish both images.
- Day-2 `alfheim-setup` updates add any secret missing from an older `.env` (existing values are never regenerated), and updates and reconfigures re-run the idempotent `init-multiple-dbs.sh` against the running `postgres-core`, so databases added after the first install are created on upgrade.
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
- Household authorization: every app backend now confirms `X-Household-ID` with `core/household` instead of comparing it with JWT household claims, which Zitadel never issues. Before, every household-scoped request that sent the header was rejected with `403`. Roles come from the membership response, not from `realm_access.roles`. The seven Python apps use `require_household`; the chat backend uses `middleware.RequireHousehold` with its own cached `householdclient` (3 s timeout). Household ids are UUIDs everywhere.
- Chat: conversations belong to one owner in one household and are listed per active household. MCP calls carry the caller's bearer token and `X-Household-ID`, and the tool loop runs on the request context. `PATCH /api/v1/chat/mcp-servers/{id}` needs the `OWNER` or `ADMIN` role. Migration `000004_household_ids_uuid` converts `conversations.household_id` and `model_blocks.household_id` to UUID; non-UUID values become `NULL`, so legacy conversations are no longer reachable and shared model blocks without a household become private.
- Maintenance: households are UUIDs from `core/household`; the local `household` table and the `device.household_id` foreign key are gone. `GET /api/v1/households` is deprecated and returns only the current household. **Data reset required:** on a database with integer households, `maintenance-backend` refuses to start (`LegacyHouseholdSchemaError`) until its tables are dropped; existing maintenance data is discarded. See the troubleshooting guide for the commands.
- Cross-app calls (shopping → pantry, maintenance → budget and shopping) always forward the caller's bearer token and `X-Household-ID`. Shopping's household list comes from `core/household` (`GET /api/v1/households/me`).
- Every frontend takes the active household from `HouseholdProvider`, sends only `X-Household-ID`, waits for a ready household before household-scoped queries (the household id is part of each query key), and renders behind `HouseholdGate`. The maintenance frontend uses UUID household ids. Budget renders the shared header with the household switcher.
- Frontend API URLs are derived from `ALFHEIM_BASE_URL`: compose sets each frontend's `NEXT_PUBLIC_API_URL` (build argument and runtime env) to its same-origin Caddy route, and every dev frontend receives the runtime OIDC settings served by `runtime-config.js`.
- Development stack: `core/household` (household-backend on 8080, household-frontend on 3000 with basePath `/household`) is wired into the root `compose.yaml` and started by `scripts/up.sh` right after the dashboard. A one-shot `household-db-init` creates `alfheim_household` / `household_user` idempotently, also on a Postgres data directory that predates the app. The dev Caddyfile routes `/api/v1/households*` and `/api/v1/profile*` to household-backend on the app and `api.*` hosts, `/household*` to household-frontend, and answers `/internal/*` with 404. `scripts/init-env.sh` generates `HOUSEHOLD_POSTGRES_PASSWORD` and `ALFHEIM_INTERNAL_TOKEN` and adds them to an existing `.env` without touching set values.
- Development stack: Zitadel's bootstrap PAT now lives in the `zitadel_machinekey` Docker volume instead of the `infrastructure/zitadel/machinekey/` bind mount. `scripts/up.sh` reads it with `docker compose cp` and falls back to `ZITADEL_BOOTSTRAP_PAT` in `.env` (then to the old bind-mount file). Production (`compose.prod.yaml`, installer) is unchanged.
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
- JWT household-claim parsing in every backend (`household_id`, `active_household_id`, `households`, `realm_access.roles`), including budget's forked `src/core/auth.py` and the app-local `get_current_user_and_home` wrappers.
- The claim-based `backend_shared` API: `get_current_user_and_home`, `get_current_user_and_household`, `UserHomeContext`, `UserHouseholdContext`, `MOCK_USER_ID`, `MOCK_HOME_ID` and the unused `decode_token` alias from `backend_shared.dependencies`, their package-root re-exports, and `get_mcp_user_context` / `mcp_user_context` from `backend_shared.mcp_middleware` (replaced by `get_mcp_household_context()` and `mcp_household_context_var`). Use `backend_shared.household`.
- `household_id` / `user_id` arguments from all MCP tools, and the `uuid5` "phantom household" derivations in the pantry and chores tools. Tools read the household from the request context only.
- The client-supplied `completed_by` field on chore completion; the authenticated caller is recorded.
- `DASHBOARD_BACKEND_URL` from shopping.
- The per-app `NEXT_PUBLIC_*_API_URL` and `NEXT_PUBLIC_API_GATEWAY_URL` variables. They pointed at `${ALFHEIM_BASE_URL}/api/...` paths Caddy does not route; `scripts/init-env.sh` drops them from an existing `.env`.
- Household, member, invite, contact and profile management from the dashboard (backend features `household`, `profile`, `contact`, the `/api/v1/households*` endpoints including contacts, the `/api/v1/profile*` endpoints, and the `/household` and `/profile` pages). They moved to `core/household`. Dashboard migration `000007_drop_household_tables` drops `households`, `household_members`, `household_invites`, `contacts` and `contact_categories` from `alfheim_dashboard` without migrating their data.
- The dashboard's `HouseholdRoleMiddleware`, which could never run because it required a household claim Zitadel does not issue.
- `resolveKeycloakUrl()` from `@alfheim/shared`. It had no callers and all of its browser fallbacks returned `${origin}/auth`, a Keycloak sub-path that Zitadel does not serve. Use the per-app `resolveOidcIssuer()` helpers, which read `NEXT_PUBLIC_OIDC_ISSUER`.
- `KEYCLOAK_REALM`, which has no Zitadel equivalent; the JWKS URI comes from the discovery document.
- `audit.md` and `backlog-coverage-gates.md`, point-in-time sprint reports with outdated claims. Their open items belong in the issue tracker.
- Dead `build:theme` npm script, which filtered a `@alfheim/keycloak-theme` package that is neither tracked nor a workspace member.
- `scripts/install.sh`, the deprecated installer. It orchestrated the pre-ADR-0003 IAM end to end and downloaded realm and theme assets that no longer exist, so it could not have succeeded. The root `install.sh` and its Go installer replace it (ADR 0004).
- Unused `IAM_POSTGRES_USER` / `IAM_POSTGRES_DB` / `IAM_POSTGRES_PASSWORD` from `scripts/init-env.sh`; nothing read them after the Zitadel migration.
- The dead `/api/v1/chat` line from `scripts/up.sh`'s post-boot summary; chat has no such top-level endpoint.
- The `app_catalog` seed insert from `scripts/seed.sh`; that table was dropped by dashboard migration `000006` (Tier-2 apps are declared in `deploy/stack-apps.yaml`, not seeded into the database).

### Deprecated
- The `KEYCLOAK_*` environment variable names. `scripts/init-env.sh` migrates them in place for one release; after that, only the `OIDC_*` names are read.

### Fixed
- `backend_shared.mcp_middleware.mount_mcp` mounts the FastMCP Streamable HTTP endpoint at exactly `/mcp` via a plain route instead of `app.mount("/mcp", mcp.http_app())`, which served it at `/mcp/mcp` and 307-redirected `POST /mcp` to a 404. The app lifespan now runs the http app's own lifespan (`mcp_app.router.lifespan_context(mcp_app)`), fixing a `500 Task group is not initialized` on every tool call. Applied to pantry, chores, maintenance, budget, library and workout (shopping has no MCP server). Chat now reports a 404 from an MCP endpoint as a configuration error instead of treating it as reachable.
- `household-frontend` calls its API same-origin (`ALFHEIM_BASE_URL`-derived, like the dashboard) instead of a separate `api.*` host.
- `scripts/up.sh` starts on macOS (Docker Desktop) without `sudo`: a one-shot `zitadel-machinekey-init` container chowns the machinekey volume to Zitadel's uid 1000, replacing the host-side `chown` that needed root and its `chmod 0777` fallback. `scripts/test-prod-startup.sh` chowns its bind mount from a throwaway root container the same way.
- `init-multiple-dbs.sh` failed with a syntax error (`ALTER DATABASE … OWNER` instead of `OWNER TO`) whenever a database already existed. It only ever ran on an empty volume before, so this never showed; the installer now re-runs it on existing installs.
- `alfheim-setup --tls internal` now serves HTTPS. It used to render `http://` URLs, `ZITADEL_EXTERNALSECURE=false` and plain-HTTP Caddy sites, and browsers disable `crypto.subtle` outside a secure context, so the PKCE login in every frontend crashed on a real hostname. The installer generates an ECDSA P-256 root CA once (`infrastructure/caddy/pki/root.{crt,key}`, public copy `infrastructure/ca/alfheim-root-ca.crt`, never rotated silently) and Caddy signs every site with it. `.env` gains `ALFHEIM_EXTRA_CA_FILE` (`/etc/alfheim/ca/alfheim-root-ca.crt` for `internal`, empty otherwise), and the install summary prints the root's path, its SHA-256 fingerprint and how to trust it. The LAN `.localhost` preset is HTTPS too.
- Installer Zitadel provisioning (and `alfheim-setup provision`, used by `scripts/up.sh`) talks to a secure install as `https://<auth host>` on Caddy's loopback listener `127.0.0.1:443`. Before, it would have received Caddy's HTTP-to-HTTPS redirect, and following it goes through public DNS and drops the bearer token. It verifies against the system roots plus the generated root, never follows redirects, and gains `--zitadel-tls-addr` and `--ca-file`.
- `alfheim-setup --reconfigure` restarts Caddy after the Edge & Identity phase, so a regenerated Caddyfile takes effect before provisioning. An existing plain-HTTP `internal` install migrates with `--reconfigure`, which also re-provisions the OIDC redirect URIs as `https://`; a plain update warns until that has happened.
- Frontends opened over plain `http://` on a host other than `localhost` show *Secure connection (HTTPS) required* with a link to the same page over `https://`. Before, browsers disabled `crypto.subtle`, PKCE threw on `digest` and the page claimed the identity provider was unreachable.
- When OIDC discovery to an `https` issuer on another host fails without an HTTP response, frontends show *Sign-in service not reachable* with a link to the issuer's discovery URL, instead of a bare "Failed to fetch". On `internal` TLS installs this usually means the auth host's certificate has not been accepted yet.

### Security
- `X-Household-ID` no longer grants anything on its own: every backend, including chat, confirms the caller's membership with `core/household` and fails closed (`503`) when it cannot. This supersedes the interim chat rule that required a matching household claim.
- MCP tools can no longer be steered into another household by the LLM: the budget tools accepted `household_id` as an argument, and the other apps' tools derived households from arguments or hardcoded ids.
- Maintenance `/maintenance/wizard` and `/maintenance/summary` had no authentication, and the summary returned every household. Both now require a household member and are scoped to `X-Household-ID`.
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
