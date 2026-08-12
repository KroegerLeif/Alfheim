# Dashboard Backend Architecture Audit (`apps/dashboard/backend`)

This document captures the audited state of the Go backend control plane service.

## 📡 HTTP Endpoints & API Route Registry

All endpoints under `/api/v1/...` are protected by JWT Bearer Authentication (Keycloak OIDC validation middleware) and the `HouseholdRoleMiddleware` which queries the user's role for the active household and sets both the context claims and the `X-Household-Role` header.

| HTTP Method | Route Path | Handler Name | Middleware / Role Requirements |
| :--- | :--- | :--- | :--- |
| **GET** | `/healthz` | *anonymous* | None (Liveness probe) |
| **GET** | `/readyz` | *anonymous* | None (Readiness probe, checks DB pool ping) |
| **GET** | `/api/v1/profile/me` | `h.GetMyProfile` | Authenticated. Auto-syncs Keycloak OIDC claims to PostgreSQL. |
| **PUT** | `/api/v1/profile/me` | `h.UpdateMyProfile` | Authenticated. Updates local DB & syncs to Keycloak Admin API. |
| **GET** | `/api/v1/apps/dashboard` | `h.GetDashboardApps` | Authenticated. Returns unified 3-tier payload (Core, Stack, User links). |
| **GET** | `/api/v1/apps` | `h.GetDashboardApps` | Authenticated. Backward-compatibility alias for 3-tier dashboard apps. |
| **GET** | `/api/v1/user/preferences` | `h.GetUserPreferences` | Authenticated. Retrieves user dashboard preferences (`hidden_app_ids`). |
| **PUT / PATCH**| `/api/v1/user/preferences` | `h.UpdateUserPreferences` | Authenticated. Updates user dashboard preferences (`hidden_app_ids`). |
| **GET** | `/api/v1/user/links` | `h.GetUserLinks` | Authenticated. Lists custom Tier 3 user links. |
| **POST** | `/api/v1/user/links` | `h.CreateUserLink` | Authenticated. Creates a new custom Tier 3 user link. |
| **PUT** | `/api/v1/user/links/{id}` | `h.UpdateUserLink` | Authenticated. Updates an existing custom Tier 3 user link. |
| **DELETE**| `/api/v1/user/links/{id}` | `h.DeleteUserLink` | Authenticated. Removes a custom Tier 3 user link. |
| **POST** | `/api/v1/households` | `h.CreateHousehold` | Authenticated. Creates a new household, assigning the user as `OWNER`. |
| **GET** | `/api/v1/households/me` | `h.GetMyHouseholds` | Authenticated. Returns all households where the user is a member/owner. |
| **GET** | `/api/v1/households/{id}` | `h.GetHouseholdDetails` | Authenticated. Returns details & member lists. Restricts access to members. |
| **POST** | `/api/v1/households/invite` | `h.CreateInvite` | Authenticated. Generates an invite token. Restricted to household `OWNER` or `ADMIN`. |
| **POST** | `/api/v1/households/join` | `h.JoinHousehold` | Authenticated. Joins the user to a household via a valid, unexpired invite token. |
| **PUT** | `/api/v1/households/{id}/members/{userID}/role` | `h.UpdateMemberRole` | Authenticated. Updates a member's role. Restricted to household `OWNER` or `ADMIN`. |
| **DELETE**| `/api/v1/households/{id}/members/{userID}` | `h.RemoveMember` | Authenticated. Removes a member. Restricted to household `OWNER` or `ADMIN`. |
| **PUT** | `/api/v1/households/{id}/address` | `h.UpdateHouseholdAddress` | Authenticated. Updates household address coordinates. Restricted to household `OWNER` or `ADMIN`. |
| **GET** | `/api/v1/households/{id}/contact-categories` | `h.GetCategories` | Authenticated. Returns contact categories for a household. |
| **POST** | `/api/v1/households/{id}/contact-categories` | `h.CreateCategory` | Authenticated. Creates a contact category. Restricted to `OWNER` or `ADMIN`. |
| **PUT** | `/api/v1/households/{id}/contact-categories/{catId}`| `h.UpdateCategory` | Authenticated. Updates a contact category. Restricted to `OWNER` or `ADMIN`. |
| **DELETE**| `/api/v1/households/{id}/contact-categories/{catId}`| `h.DeleteCategory` | Authenticated. Deletes a category. Restricted to `OWNER` or `ADMIN`. |
| **GET** | `/api/v1/households/{id}/contacts` | `h.GetContacts` | Authenticated. Returns contacts for a household. Restricted to members. |
| **POST** | `/api/v1/households/{id}/contacts` | `h.CreateContact` | Authenticated. Creates a contact. Restricted to `OWNER`, `ADMIN`, or `MEMBER`. |
| **PUT** | `/api/v1/households/{id}/contacts/{contactId}` | `h.UpdateContact` | Authenticated. Updates a contact. Restricted to members. |
| **DELETE**| `/api/v1/households/{id}/contacts/{contactId}` | `h.DeleteContact` | Authenticated. Deletes a contact. Restricted to members. |
| **GET** | `/api/v1/telemetry/metrics` | `h.GetMetrics` | Authenticated. Returns system metrics (CPU, Memory, network, uptime). |
| **GET** | `/api/v1/telemetry/logs` | `h.GetLogs` | Authenticated. Returns platform logs. |

---

## 🗄️ Database Schemas (PostgreSQL)

### `user_profiles`
Holds local synced user profiles from Keycloak OIDC claims.
```sql
CREATE TABLE user_profiles (
    id VARCHAR(64) PRIMARY KEY, -- Keycloak sub UUID
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `user_preferences` (Tier 1 Core App Visibility)
Stores user-specific settings such as hidden Core Apps.
```sql
CREATE TABLE user_preferences (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    hidden_app_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `user_links` (Tier 3 Custom User Links)
Stores user-specific custom bookmarks.
```sql
CREATE TABLE user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    url TEXT NOT NULL,
    icon VARCHAR(100) DEFAULT 'link',
    category VARCHAR(50) DEFAULT 'user',
    description TEXT DEFAULT '',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_links_user ON user_links(user_id);
```

---

## 🏗️ Modular 3-Tier Code Structure (`internal/features/apps/`)

* [`tier1_core_registry.go`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/internal/features/apps/tier1_core_registry.go): Pre-built native Core Apps (`pantry`, `shopping`, `maintenance`, `chores`, `todo`).
* [`tier2_stack_config.go`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/internal/features/apps/tier2_stack_config.go): Struct definitions matching server-level `deploy/stack-apps.yaml`.
* [`tier2_stack_loader.go`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/internal/features/apps/tier2_stack_loader.go): YAML parser loading Stack Apps at startup.
* [`tier3_user_preference.go`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/internal/features/apps/tier3_user_preference.go): User preferences domain entity.
* [`tier3_user_link.go`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/internal/features/apps/tier3_user_link.go): Custom user link domain entity.
* [`models.go`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/internal/features/apps/models.go): Shared DTO and response payload contracts.

---

## ⚙️ Environment Variables & Service Dependencies

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port for Go HTTP web server. |
| `ENVIRONMENT` | `development` | Runtime environment mode. |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/dashboard_db?sslmode=disable` | PostgreSQL URL. |
| `STACK_APPS_PATH` | `deploy/stack-apps.yaml` | Path to Tier 2 stack integrations YAML configuration file. |
| `MIGRATIONS_DIR` | `migrations` | Path to Go SQL migration files. |
| `KEYCLOAK_BASE_URL` | `http://localhost:8080` | Keycloak server base address. |
| `KEYCLOAK_REALM` | `alfheim` | Keycloak realm name. |
