---
title: "Central Dashboard Control Plane"
description: "Central control plane, landing page launcher, application registry, and telemetry interface for the Alfheim platform."
---

> **TL;DR:** Central control plane, landing page launcher, application registry, and telemetry interface for the Alfheim platform.

> **Note:** Households, members and roles, invites, contacts and the user profile moved to the Tier-1 app `core/household` (served under `/household`). The dashboard no longer exposes `/api/v1/households*` or `/api/v1/profile*`. Only the household launchers and typed plugins read `X-Household-ID`, and they confirm it against the `core/household` membership API; `X-Household-Role` is always ignored.

Source: [`core/dashboard/`](https://github.com/KroegerLeif/Alfheim/tree/main/core/dashboard)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Single entry point for all home apps | Centralized dashboard launcher rendering registered microservices |
| Mixed ecosystem (Native vs. Homelab) | 3-Tier Application Registry (Native Core Apps, Stack YAML, User Bookmarks) plus household launchers |
| Household web apps (Home Assistant, Jellyfin, ...) | Household launchers that owners and admins manage in the UI, without a redeploy |
| Backend integrations with secrets | Typed plugins: per-household configuration, encrypted credentials, an on-demand connection test and an enable toggle |
| Household management | Launcher tile and navigation links to the `core/household` app (`/household`, `/household/profile`) |
| System health visibility | Platform telemetry endpoints for system metrics (CPU, RAM) and logs |

---

## 🏛️ 3-Tier Application Registry Architecture

The platform organizes applications, portals, and bookmarks into three distinct architectural tiers:

1. **Tier 1 (Core Apps):** Native monorepo microservices registered in Go (`internal/features/apps/tier1_core_registry.go`). The backend reads `ALFHEIM_ENABLED_APPS` once at startup and keeps only the enabled apps: the household tile is always listed, an unset variable (or `all`) lists every app, and unknown names are ignored. A disabled app therefore has no tile. Visible to all authenticated users; visibility can be toggled per user in `user_preferences`.
2. **Tier 2 (Stack Apps / Integrations):** External homelab stack applications configured via server-level [`deploy/stack-apps.yaml`](../../../../deploy/stack-apps.yaml) and filtered dynamically by OIDC roles.
3. **Tier 3 (User Links):** Personal custom bookmarks stored in PostgreSQL `user_links` (`GET/POST/PUT/DELETE /api/v1/user/links`).

### Link scopes

Links to web apps Alfheim does not run come from three scopes:

| Scope | Managed by | Stored in | Seen by |
| :--- | :--- | :--- | :--- |
| Operator stack apps (Tier 2) | The operator, by editing a file and restarting the dashboard backend | [`deploy/stack-apps.yaml`](../../../../deploy/stack-apps.yaml) | Every user of the installation (filtered by OIDC roles) |
| Household launchers | Household `OWNER` and `ADMIN` in the dashboard | `household_launchers`, one row set per household | Every member of that household |
| Personal links (Tier 3) | Each user | `user_links` | Only that user |

The dashboard grid shows them in this order: Tier-1 apps, household launchers, operator stack apps, personal links.

### Household launchers

A launcher is a link and nothing else ([ADR 0010](../../explanation/decisions/0010-integration-architecture.md)): title, URL, icon, description and display order. The backend never calls the target and stores no credential for it, and the frontend opens it in a new tab with `rel="noopener noreferrer"`, never in a frame. A target that needs a secret or a server-side request is a typed plugin, not a launcher. How-to: [Add an external app launcher](../../how-to/add-external-app-launcher.md).

Every request sends `X-Household-ID`; `household.RequireHousehold` (`packages/go-shared`) confirms the membership against `core/household` and every query filters by that household. The household never comes from the token or the request body; a body with a `household_id` field is rejected.

| Method and path | Role | Answer |
| :--- | :--- | :--- |
| `GET /api/v1/launchers?limit=&offset=` | Any member | `200` with `{"items": [...], "total", "limit", "offset"}`; `limit` 1 to 100 (default 100), `offset` from 0 |
| `POST /api/v1/launchers` | `OWNER`, `ADMIN` | `201` with the launcher |
| `PUT /api/v1/launchers/{id}` | `OWNER`, `ADMIN` | `200` with the launcher; the body replaces every field |
| `DELETE /api/v1/launchers/{id}` | `OWNER`, `ADMIN` | `204` |

Request body: `{"title", "url", "icon", "description", "display_order"}`. Invalid input is rejected, never rewritten:

* `title`: required, at most 100 characters, no control characters.
* `url`: required, at most 2048 characters, an absolute `http` or `https` URL with a host, without user name or password (`user:pass@`), whitespace or backslashes. `javascript:`, `data:` and relative URLs are rejected.
* `icon`: one of the allowed lucide icon names (`internal/features/launchers/icons.go`, mirrored by the frontend); empty means `link`.
* `description`: at most 500 characters. `display_order`: 0 to 10000.

Errors use `{"detail": {"code", "message"}}` ([ADR 0011](../../explanation/decisions/0011-headless-api-contract.md)): `422 validation_error` with the rejected fields in `detail.errors`, `400 invalid_body` for malformed JSON or unknown fields, `403 household_role_forbidden` for a `MEMBER` or `GUEST` on a write, `404 launcher_not_found` for an id that is not in the caller's household, and the household codes (`400 household_required`, `403 household_forbidden`, `503 household_service_unavailable`) from the membership check.

### Typed plugins

A typed plugin is a backend integration with configuration, encrypted credentials, a health check and an enable toggle ([ADR 0010](../../explanation/decisions/0010-integration-architecture.md)). The framework lives in `internal/features/plugins`; this release registers the [Home Assistant](#home-assistant) plugin (`homeassistant`) and the media server plugins `jellyfin` and `navidrome` (see [Media servers](#media-servers)). Each household has at most one row per plugin type (`household_plugins`). Household and role checks work as for launchers.

| Method and path | Role | Answer |
| :--- | :--- | :--- |
| `GET /api/v1/integrations/plugins` | Any member | `200` with `{"items": [...], "encryption_available"}`: every registered type, merged with the household's row |
| `PUT /api/v1/integrations/plugins/{type}` | `OWNER`, `ADMIN` | `200` with the plugin; stores the configuration and resets the health to `unknown` |
| `POST /api/v1/integrations/plugins/{type}/test` | `OWNER`, `ADMIN` | `200` with the plugin and the stored result of a fresh connection test |

A plugin item is `{"type", "configured", "enabled", "base_url", "config", "has_credentials", "health": {"status", "detail", "checked_at"}, "updated_at"}`. `config` is non-secret by contract; credentials are write-only and never returned, logged or echoed in `health.detail` (the backend redacts every credential value and caps the detail at 500 characters).

Request body of `PUT`: `{"enabled", "base_url", "config", "credentials"}`.

* `base_url`: empty, or an absolute `http`/`https` URL of at most 2048 characters without user name, password, query or fragment.
* `config`: a JSON object of at most 16 KiB; the plugin validates it and rejects unknown fields.
* `credentials`: omitted or `null` keeps the stored credentials, an object of up to 16 lower-case names with values up to 4096 characters replaces them, `{}` removes them. They are encrypted with AES-256-GCM (`INTEGRATIONS_ENCRYPTION_KEY`) and the row stores the key id (`INTEGRATIONS_ENCRYPTION_KEY_ID`).

`health.status` is one of `unknown`, `ok`, `host_not_allowed`, `unreachable`, `timeout`, `auth_failed`, `invalid_response`, `invalid_config`, `credentials_unavailable` and `error`. A test first checks `base_url` against go-shared `netguard` with `INTEGRATIONS_ALLOWED_HOSTS`: a private address that is not allow-listed fails with `host_not_allowed` and no request is sent. Every plugin request then goes through the netguard client (address re-checked at connect time, no redirects, no proxy) with a 5 s timeout.

Errors: `422 validation_error`, `400 invalid_body` (malformed JSON or unknown fields such as `household_id`), `403 household_role_forbidden` for a `MEMBER` or `GUEST` on a write, `404 plugin_type_unknown` for a type this build does not register, `404 plugin_not_configured` when testing a type the household never saved (rows of other households are never visible), `503 integrations_encryption_unavailable` when credentials are sent but no key is configured, plus the household codes from the membership check.

**Without an encryption key** the dashboard still starts and logs a warning: plugins can be listed, saved without credentials and toggled, but storing credentials fails with `503` and stored credentials read as `credentials_unavailable`. A row sealed with another key id also reads as `credentials_unavailable` until its credentials are entered again.

`PUT` answers `502 plugin_lifecycle_failed` when a plugin that implements `plugins.EnableObserver` refuses an enable or disable (Home Assistant: the household API could not create or remove the service binding); nothing is stored then. The observer gets the saving admin's bearer token.

#### Adding a plugin

* **Backend:** implement `plugins.Plugin` (`Type`, `ValidateConfig`, `HealthCheck`) in `internal/features/integrations/<type>`, construct it in `cmd/server/integrations.go` with the client from `plugins.NewHTTPClient(guard, plugins.DefaultTimeout)` and pass it to `plugins.NewRegistry`. Use `plugins.HealthFromError` for transport errors. Optional capabilities are interfaces the consuming feature declares; `plugins.CapabilityOf[C](registry, type)` finds them.
* **Other features** reach a household's plugin through `*plugins.Service`: `Instance` (configuration and decrypted credentials), `EnabledInstance` (also fails with `ErrDisabled` or `ErrHostNotAllowed`), `IsEnabled` and `Registry`.
* **Frontend:** add a `PluginUiEntry` (`titleKey` and a `Form` component receiving `PluginFormProps`) to `PLUGIN_FORMS` in `src/features/integrations/pluginForms.ts`. The generic `PluginCard` provides the health badge, the credential indicator, the enable toggle and the test button; only `OWNER` and `ADMIN` see the controls and the form.

#### Media servers

`jellyfin` and `navidrome` (`internal/features/integrations/{jellyfin,navidrome}`) report what the household's LAN media servers play. Alfheim only sends status and control calls; media streams stay between the player and the server and are never proxied or transcoded. How-to: [Connect a media server](../../how-to/connect-media-server.md).

| Plugin | Credentials | Health | Now playing | Control |
| :--- | :--- | :--- | :--- | :--- |
| `jellyfin` | `api_key` | `GET /System/Info` | `GET /Sessions?activeWithinSeconds=60` | `POST /Sessions/{id}/Playing/{PlayPause,NextTrack,PreviousTrack,Stop}` |
| `navidrome` | `username`, `password` | `GET /rest/ping.view` | `GET /rest/getNowPlaying.view` | None (Subsonic has no remote control) |

Jellyfin requests carry `Authorization: MediaBrowser Token="<key>"`. Navidrome requests use Subsonic token authentication: `u`, `t = md5(password + salt)`, a fresh random `s` per request, `v=1.16.1`, `c=alfheim`, `f=json`; the password is never sent. The values of `t`, `s` and `p` are redacted from every URL that can reach a log line. Neither plugin takes `config` settings.

The `media` feature (`internal/features/integrations/media`) sits on top. A plugin opts in by implementing `media.Source` (now playing) and optionally `media.Controller` (playback control); the feature finds them with `plugins.CapabilityOf`.

| Method and path | Role | Answer |
| :--- | :--- | :--- |
| `GET /api/v1/integrations/media/now-playing` | Any member | `200` with `{"items": [MediaStatus], "sources": [{"source", "status"}]}` for every enabled media plugin |
| `POST /api/v1/integrations/media/{type}/sessions/{id}/{command}` | `OWNER`, `ADMIN`, `MEMBER` | `204` once the server accepted the command |

`MediaStatus` is `{"source", "session_id", "title", "artist", "device", "state", "can_control"}` with `state` `playing` or `paused`; `can_control` is always `false` for a server without control. A server that fails is listed in `sources` with a code (`auth_failed`, `unreachable`, `timeout`, `host_not_allowed`, `credentials_unavailable`, `invalid_response`, `error`) and does not hide the sessions of the others. `{command}` is `play_pause`, `next`, `previous` or `stop`; `{id}` must match `[A-Za-z0-9_-]{1,128}`.

Control errors: `400 media_command_invalid`, `400 media_session_invalid`, `403 household_role_forbidden` for a `GUEST`, `404 media_type_unknown`, `404 media_not_configured`, `404 media_session_not_found`, `409 media_disabled`, `409 media_control_unsupported` (Navidrome), `503 media_credentials_unavailable` and `502 media_upstream_error` with a `reason` code for a failed server call.

#### ALFI card

The ALFI card in the integrations settings is **not** a backend plugin type. Chat's household-shared model blocks stay the only store of LLM providers and their keys ([ADR 0010 §5](../../explanation/decisions/0010-integration-architecture.md)), and a backend `alfi` type would need the user's token inside the health check, which the plugin contract does not carry. The card is therefore a frontend view (`src/features/integrations/alfi`) that calls chat's public API with the user's token and household:

* `GET /api/v1/user/capabilities` first: `{"operator", "chat"}`, where `chat` reflects `ALFHEIM_ENABLED_APPS`. Without chat the card shows "Chat module not installed" and the command `alfheim-setup apps enable chat`, and sends no request to chat.
* `GET` and `PUT /api/v1/chat/model-blocks/household-default` read and write the household's default shared model block (see the [chat reference](./chat.md)); only `OWNER` and `ADMIN` see the form. Presets: Ollama (`http://<host>:11434`, no key) and OpenAI-compatible (base URL and key). The card names `CHAT_ALLOWED_LLM_HOSTS` and explains a rejected host. Keys are write-only; the card only shows `has_api_key`.
* After a save the card runs chat's health check. The dashboard's ALFI tile (`chat`) stays hidden until at least one model block the user may use reports `health_status: ok`.

How-to: [Connect ALFI to a local model](../../how-to/connect-alfi-local-model.md).

#### Home Assistant

The `homeassistant` plugin ([#957](https://github.com/KroegerLeif/Alfheim/issues/957), [#960](https://github.com/KroegerLeif/Alfheim/issues/960)) stores the base URL, the long-lived access token (credential `token`) and the settings `{"pinned_entities": ["sensor.x", ...], "allow_control": false}` (at most 50 unique entity ids of the form `domain.object_id`; unknown fields are rejected). The health check calls `GET {base}/api/` and expects `{"message": "API running."}`; `401` or `403` reads as `auth_failed`. Every request goes through the netguard client. The token never appears in a response, a log line or a health detail. How-to: [Connect Home Assistant](../../how-to/connect-home-assistant.md).

| Endpoint | Caller | Result |
| :--- | :--- | :--- |
| `GET /api/v1/integrations/home-assistant/status` | Any member | `{"enabled", "mcp_available", "allow_control"}`; chat reads it with the user's token |
| `GET /api/v1/integrations/home-assistant/states` | Any member | `{"items": [{"entity_id", "state", "friendly_name", "unit", "last_changed", "found"}]}` for the pinned entities, cached 10 s per household |
| `POST`, `DELETE /api/v1/integrations/home-assistant/mcp` | Any member | Streamable HTTP MCP proxy to `{base}/api/mcp` with the stored token (12 s timeout); `GET` answers `405` |
| `GET /api/v1/integrations/home-assistant/webhook` | `OWNER`, `ADMIN` | `{"webhook_id", "has_secret", "path"}` |
| `POST /api/v1/integrations/home-assistant/webhook/secret` | `OWNER`, `ADMIN` | Generates a new secret and answers it once (`Cache-Control: no-store`) |
| `GET`, `POST /api/v1/integrations/home-assistant/rules`, `DELETE .../rules/{id}` | `OWNER`, `ADMIN` | Rules `{"event_type", "action": "chores.create_instance", "params": {"template_id"}}`; a POST replaces the rule of its event type |
| `GET /api/v1/integrations/home-assistant/events` | `OWNER`, `ADMIN` | The 20 newest events with `status` `received`, `executed`, `skipped`, `ignored` or `failed` |
| `POST /api/v1/integrations/home-assistant/events` | No JWT, HMAC signature | The webhook, see below |

Service principals are not admitted on any of these routes. Errors use `{"detail": {"code", "message"}}`: `404 home_assistant_not_enabled`, `502 home_assistant_host_not_allowed`, `502 home_assistant_auth_failed`, `502 home_assistant_unavailable`, `503 home_assistant_credentials_unavailable`.

**MCP proxy.** With `allow_control` off, only tools named `Get…`, `HassGet…`, `get_…` or containing `_get_` count as read-only. The proxy removes every other tool from `tools/list` results (JSON and `text/event-stream`) and answers a `tools/call` of such a tool itself with JSON-RPC error `-32001`, without contacting Home Assistant. A message it cannot parse is rejected (`400`), an upstream answer it cannot parse is `502`.

**Webhook.** Headers `X-Alfheim-Webhook-Id` (the plugin row id), `X-Alfheim-Timestamp` (unix seconds) and `X-Alfheim-Signature` (`sha256=` + hex HMAC-SHA256 of `timestamp + "." + raw body` with the webhook secret). The body is at most 16 KiB and exactly `{"event_id", "event_type", "data"}`: `event_id` is 1-200 printable ASCII characters without spaces, `event_type` matches `^[a-z0-9][a-z0-9_.:-]{0,63}$`. Order of checks: `413` for a large body, `404 webhook_not_found` for an unknown id, `401 webhook_signature_invalid` for a timestamp outside ±300 s or a wrong signature (constant-time compare), `404` when the plugin is disabled, `422 webhook_payload_invalid`. The household is the plugin row's. A known `event_id` answers `200` with `"replay": true` and runs nothing. Otherwise the household's rule for the event type runs: `200 executed`, `202 skipped` (chores not installed), `202 ignored` (no rule), `502 failed`.

**Actions.** `chores.create_instance` calls `POST {INTEGRATIONS_CHORES_URL}/api/v1/chores/instances` with `{"template_id"}`, `X-Household-ID`, `Idempotency-Key: <event_id>` and a client-credentials token of the service principal (cached until 30 s before expiry; token endpoint from the issuer's discovery document). Enabling the plugin creates the binding `POST /api/v1/households/{id}/service-bindings` with the scope `chores:create_instance` on the household API, as the admin who saved; disabling deletes it (`404` counts as removed).

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Go 1.27 REST API backend utilizing Chi router, PostgreSQL (`pgxpool`), and generic OIDC (Zitadel) bearer-token middleware.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_dashboard` database, owned by `dashboard_user`).

### FDD Domain Features (`internal/features/`)
- `apps`: Unified 3-Tier application registry handlers and YAML loaders.
- `launchers`: Household launchers (entity, repository, service, handler), behind `household.RequireHousehold` and, for writes, `household.RequireHouseholdRole`.
- `integrations/homeassistant`: the Home Assistant plugin, states, MCP proxy and signed webhook; `integrations/actions`: event rules, the event log and the action executors (`chores.create_instance`), the service principal token source and the household binding client. See [Home Assistant](#home-assistant).
- `plugins`: The typed plugin framework (contract, registry, credential cipher, repository, service, handler) behind the same household middleware; see [Typed plugins](#typed-plugins).
- `integrations/{jellyfin,navidrome,media}`: The media server plugins and the now-playing and control API; see [Media servers](#media-servers).
- `capabilities`: `GET /api/v1/user/capabilities` with `operator` and `chat` (UI hints only).
- `apps` also serves `GET /api/v1/apps/enabled`: `{"apps": ["household", ...]}`, the Tier-1 app ids from `ALFHEIM_ENABLED_APPS` (authenticated, independent of hidden tiles and health). `useAppEnabled` in `@alfheim/shared` reads it once per page load, so other frontends leave out entry points into an app that is not installed (pantry hides the ALFI chat button and widget without the chat app).
- `apphealth`: Live state of the Tier-1 tiles. `GET /api/v1/apps/health` returns `{"apps": {"<id>": "online|degraded|offline"}, "checked_at": ...}`. The backend probes each enabled app backend's readiness endpoint (`/readyz`) on `gateway-net` (2 s timeout): a `2xx` answer is *online*, any other answer *degraded* (for example a backend whose database is down or behind on migrations), no answer *offline*. Snapshots are cached for 15 s and concurrent requests share one probe round, so each app is probed at most once per window however many dashboards are open. The frontend polls every 15 s, so a stopped app turns offline within 30 s, and never calls the app APIs itself. Tier-2 stack apps are not probed.
- `telemetry`: System metrics and log queries. When VictoriaLogs is unreachable or empty, `GET /api/v1/telemetry/logs` returns a fixed set of illustrative entries (they only reference routes the dashboard serves); the frontend shows a notice when the log request itself fails.

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 18 Core Database Server |
| `dashboard-backend` | 8080 | `/api/v1/apps`, `/api/v1/apps/health`, `/api/v1/apps/enabled`, `/api/v1/launchers*`, `/api/v1/integrations/plugins*`, `/api/v1/integrations/home-assistant/*`, `/api/v1/user/*`, `/api/v1/telemetry*` | Go REST API Control Plane |
| `dashboard-frontend` | 3000 | `alfheim.loegien.localhost/` | Next.js Landing Page Control Plane |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://dashboard_user:postgres@postgres-core:5432/alfheim_dashboard?sslmode=disable` | PostgreSQL connection string |
| `STACK_APPS_PATH` | `deploy/stack-apps.yaml` | Path to Tier 2 stack integrations manifest |
| `ALFHEIM_ENABLED_APPS` | `all` | Enabled optional apps; decides the Tier-1 tiles. Unset or `all` lists every app, an empty value only the household tile |
| `OIDC_ISSUER_URL` | `https://auth.loegien.de` | Canonical OIDC issuer; JWKS URI is discovered from its `/.well-known/openid-configuration` |
| `OIDC_AUDIENCE` | `alfheim` | Required value in the token `aud` claim |
| `ALFHEIM_INTERNAL_TOKEN` | (generated) | Required. Service token for the `core/household` membership API that confirms the household of launcher requests; the backend refuses to start without it |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the membership API |
| `INTEGRATIONS_ENCRYPTION_KEY` | (generated) | AES-256 key (base64) for plugin credentials. Empty: the backend starts but refuses to store or read credentials; a malformed key stops startup |
| `INTEGRATIONS_ENCRYPTION_KEY_ID` | `v1` | Key id stored with each plugin row |
| `INTEGRATIONS_ALLOWED_HOSTS` | _(empty)_ | Private hosts, IPs or CIDR ranges plugins may reach; empty allows public addresses only |
| `INTEGRATIONS_PRINCIPAL_ID`, `INTEGRATIONS_CLIENT_ID`, `INTEGRATIONS_CLIENT_SECRET`, `ZITADEL_PROJECT_ID` | (provisioned) | Service principal of plugin actions (#958). Any of them empty or `__PROVISIONED__` switches actions off; the backend logs a warning |
| `INTEGRATIONS_CHORES_URL` | `http://chores-backend:8000` | Chores public API that `chores.create_instance` calls |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 🗄️ Database Schema (PostgreSQL)

The Go control plane initializes its tables via SQL migrations:
* `user_profiles`: Minimal local user row, provisioned Just-In-Time from OIDC token claims on the first write, because `user_preferences` and `user_links` reference it by foreign key. The dashboard does not manage profile data; that lives in `core/household`. Migration `000007` dropped the former `households`, `household_members`, `household_invites`, `contacts` and `contact_categories` tables.
* `user_preferences`: User dashboard settings and hidden core app IDs (`hidden_app_ids TEXT[]`).
* `user_links`: Personal custom bookmarks (`title`, `url`, `icon`, `category`, `display_order`).
* `household_launchers` (migration `000008`): Household launchers (`household_id`, `title`, `url`, `icon`, `description`, `display_order`, `created_by`), indexed by `household_id`. There is no foreign key to the household, which lives in `core/household`'s database.
* `household_plugins` (migration `000009`): Typed plugin settings per household (`household_id`, `type`, `enabled`, `base_url`, `config` JSONB, `credentials_encrypted`, `credentials_key_id`, `health_status`, `health_checked_at`, `health_detail`), unique on `(household_id, type)`.
* `integration_rules`, `integration_events`, `integration_webhooks` (migration `000010`): action rules per household and plugin type (unique on `(household_id, plugin_type, event_type)`), received events (unique on `(plugin_id, event_id)` for idempotency, with status, action and detail) and each plugin row's sealed webhook secret. Events and secrets are deleted with their plugin row.

---

## ⚠️ Known Issues & Open Follow-Ups

The dashboard is a launcher (app catalog, household launchers, user links and preferences, plus the
telemetry view) after households, members, roles, invites, contacts and the user profile moved
to `core/household`. There is no further "slimming" planned; the dashboard becomes its own app
sprint later, at which point its Go backend, the 3-tier registry, and the telemetry view are
candidates for review. No known open bugs beyond the general items in
[Known Issues](../../explanation/known-issues.md).

---
