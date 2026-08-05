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
| **GET** | `/api/v1/apps` | `h.GetAppCatalog` | Authenticated. Parses `X-Household-Role` (header or query string) to filter apps (default `MEMBER`). |
| **POST** | `/api/v1/apps` | `h.CreateApp` | Authenticated. Registers new app in the catalog. |
| **PUT** | `/api/v1/apps/{id}` | `h.UpdateApp` | Authenticated. Updates app registration info in the catalog. |
| **POST** | `/api/v1/households` | `h.CreateHousehold` | Authenticated. Creates a new household, assigning the user as `OWNER`. |
| **GET** | `/api/v1/households/me` | `h.GetMyHouseholds` | Authenticated. Returns all households where the user is a member/owner. |
| **GET** | `/api/v1/households/{id}` | `h.GetHouseholdDetails` | Authenticated. Returns details & member lists. Restricts access to members. |
| **POST** | `/api/v1/households/invite` | `h.CreateInvite` | Authenticated. Generates an invite token. Restricted to household `OWNER` or `ADMIN`. |
| **POST** | `/api/v1/households/join` | `h.JoinHousehold` | Authenticated. Joins the user to a household via a valid, unexpired invite token. |
| **PUT** | `/api/v1/households/{id}/members/{userID}/role` | `h.UpdateMemberRole` | Authenticated. Updates a member's role. Restricted to household `OWNER` or `ADMIN`. |
| **DELETE**| `/api/v1/households/{id}/members/{userID}` | `h.RemoveMember` | Authenticated. Removes a member. Restricted to household `OWNER` or `ADMIN`. Owners cannot be removed. |
| **PUT** | `/api/v1/households/{id}/address` | `h.UpdateHouseholdAddress` | Authenticated. Updates household address coordinates. Restricted to household `OWNER` or `ADMIN`. |
| **GET** | `/api/v1/households/{id}/contact-categories` | `h.GetCategories` | Authenticated. Returns contact categories for a household. Restricted to members. |
| **POST** | `/api/v1/households/{id}/contact-categories` | `h.CreateCategory` | Authenticated. Creates a contact category. Restricted to `OWNER` or `ADMIN`. |
| **PUT** | `/api/v1/households/{id}/contact-categories/{catId}`| `h.UpdateCategory` | Authenticated. Updates a contact category. Restricted to `OWNER` or `ADMIN`. |
| **DELETE**| `/api/v1/households/{id}/contact-categories/{catId}`| `h.DeleteCategory` | Authenticated. Deletes a category. Restricted to `OWNER` or `ADMIN`. |
| **GET** | `/api/v1/households/{id}/contacts` | `h.GetContacts` | Authenticated. Returns contacts for a household. Restricted to members. |
| **POST** | `/api/v1/households/{id}/contacts` | `h.CreateContact` | Authenticated. Creates a contact. Restricted to `OWNER`, `ADMIN`, or `MEMBER`. |
| **PUT** | `/api/v1/households/{id}/contacts/{contactId}` | `h.UpdateContact` | Authenticated. Updates a contact. Restricted to members. |
| **DELETE**| `/api/v1/households/{id}/contacts/{contactId}` | `h.DeleteContact` | Authenticated. Deletes a contact. Restricted to members. |
| **GET** | `/api/v1/telemetry` | `h.GetMetrics` | Authenticated. Returns system metrics (CPU, Memory, network, uptime). |
| **GET** | `/api/v1/telemetry/metrics` | `h.GetMetrics` | Authenticated. Alias endpoint for system metrics. |
| **GET** | `/api/v1/telemetry/logs` | `h.GetLogs` | Authenticated. Returns simulated or SigNoz-fetched platform logs. |

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

### `households`
Defines a household containing address information and coordinates.
```sql
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    owner_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    street VARCHAR(255) NOT NULL DEFAULT '',
    zip VARCHAR(20) NOT NULL DEFAULT '',
    city VARCHAR(150) NOT NULL DEFAULT '',
    country VARCHAR(150) NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_households_owner ON households(owner_id);
```

### `household_members`
Association table linking users and households with access permissions.
```sql
CREATE TABLE household_members (
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER', -- OWNER, ADMIN, MEMBER, GUEST
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (household_id, user_id)
);
CREATE INDEX idx_household_members_user ON household_members(user_id);
```

### `household_invites`
One-time or multi-use invite links to join households.
```sql
CREATE TABLE household_invites (
    token VARCHAR(128) PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    inviter_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INT NOT NULL DEFAULT 1,
    uses INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_household_invites_household ON household_invites(household_id);
```

### `contact_categories`
Household-scoped categories to classify contacts.
```sql
CREATE TABLE contact_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT '',
    color VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contact_categories_household ON contact_categories(household_id);
```

### `contacts`
Household-scoped address book entries.
```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    category_id UUID REFERENCES contact_categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    address TEXT DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    description TEXT DEFAULT '',
    links JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contacts_household ON contacts(household_id);
```

### `app_catalog`
Stores available internal apps and external portals shown on the dashboard.
```sql
CREATE TABLE app_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon_url TEXT DEFAULT '',
    app_url TEXT NOT NULL,
    required_role VARCHAR(50) DEFAULT 'MEMBER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    category VARCHAR(50) NOT NULL DEFAULT 'internal', -- 'internal' | 'external'
    display_order INT NOT NULL DEFAULT 0,
    is_external BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' | 'in_progress' | 'maintenance'
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_app_catalog_active ON app_catalog(is_active);
CREATE INDEX idx_app_catalog_category_order ON app_catalog(category, display_order);
CREATE INDEX idx_app_catalog_external_status ON app_catalog(is_external, status);
```

---

## ⚙️ Environment Variables & Service Dependencies

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port for Go HTTP web server. |
| `ENVIRONMENT` | `development` | Runtime environment mode (e.g. `development`, `production`). |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/dashboard_db?sslmode=disable` | Connection details for PostgreSQL server instance. |
| `DB_MAX_CONNS` | `25` | Pool limit for concurrent database connections. |
| `DB_MIN_CONNS` | `5` | Idle base connection count kept in pool. |
| `DB_MAX_CONN_LIFETIME_MINUTES` | `30` | Lifespan before individual connections get recycled. |
| `MIGRATIONS_DIR` | `migrations` | Disk path to Go SQL migration files. |
| `KEYCLOAK_BASE_URL` | `http://localhost:8080` | Keycloak server base address. |
| `KEYCLOAK_REALM` | `loeger-os` | Keycloak realm name. |
| `KEYCLOAK_CLIENT_ID` | `dashboard-backend` | App OAuth Client identity. |
| `KEYCLOAK_CLIENT_SECRET` | *empty* | OAuth Client password credentials (if required). |
| `KEYCLOAK_JWKS_URL` | `BaseURL/realms/Realm/protocol/openid-connect/certs` | JWKS JSON keys retrieval URI. |
