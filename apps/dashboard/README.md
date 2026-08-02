# Loeger OS Dashboard Micro-Service (`apps/dashboard`)

The Dashboard is the central control plane, authentication entrypoint, and telemetry interface for the `loeger-os` platform. It consists of a React/Next.js frontend and a Go control plane backend.

---

## 🛠 Tech Stack
* **Frontend**: Next.js 15+ (App Router, Standalone Build), TanStack React Query, Ky HTTP Client, Tailwind CSS.
* **Backend**: Go 1.22+, Chi HTTP router, pgx PostgreSQL driver, golang-jwt validator.
* **Database**: PostgreSQL 16.

---

## 🔑 Authentication
All backend API routes under `/api/v1/...` (except `/healthz` and `/readyz`) require authentication.
Requests must include a valid OpenID Connect (OIDC) JWT token issued by Keycloak in the headers:
```http
Authorization: Bearer <Keycloak_JWT_Token>
```

---

## 📡 API Specification

### 1. Application Catalog Endpoints

#### `GET /api/v1/apps`
Retrieve permitted applications from the catalog for the current user based on their roles and household permissions.
* **Authentication**: Required (OIDC user bearer token)
* **Headers**:
  * `X-Household-Role` (Optional): `ADMIN` | `MEMBER`. Defaults to `MEMBER` if not supplied.
* **Response (200 OK)**:
  ```json
  {
    "internal": [
      {
        "id": "uuid-string",
        "name": "pantry",
        "title": "Pantry Manager",
        "description": "Stock management and inventory tool",
        "url": "/pantry",
        "icon": "inventory",
        "status": "healthy",
        "required_role": "MEMBER",
        "category": "internal"
      }
    ],
    "external": [
      {
        "id": "uuid-string",
        "name": "nas-admin",
        "title": "NAS Admin Panel",
        "description": "External storage administration",
        "url": "http://nas.local/admin",
        "icon": "settings",
        "status": "healthy",
        "required_role": "ADMIN",
        "category": "external"
      }
    ]
  }
  ```

#### `POST /api/v1/apps`
Register a new application in the catalog.
* **Authentication**: Required (OIDC admin token)
* **Request Body DTO**:
  ```json
  {
    "name": "shopping",
    "title": "Shopping List",
    "description": "Collaborative list management",
    "url": "/shopping",
    "icon": "shopping_cart",
    "status": "healthy",
    "required_role": "MEMBER",
    "is_external": false
  }
  ```
* **Response (201 Created)**: Created application object.

#### `PUT /api/v1/apps/{id}`
Update an existing application configuration.
* **Authentication**: Required (OIDC admin token)
* **Request Body DTO**: Partial fields from creation request payload.
* **Response (200 OK)**: Updated application object.

---

### 2. Telemetry Endpoints

#### `GET /api/v1/telemetry/metrics` (alias `/api/v1/telemetry`)
Retrieve system health telemetry (CPU, memory, network, uptime). Queries SigNoz cluster if present, otherwise returns simulated local metrics.
* **Authentication**: Required
* **Response (200 OK)**:
  ```json
  {
    "cpu_percent": 14.2,
    "memory_percent": 42.8,
    "memory_used_gb": 6.8,
    "memory_total_gb": 16.0,
    "network_rx_mbps": 2.4,
    "network_tx_mbps": 1.8,
    "uptime_seconds": 432100,
    "active_containers": 6
  }
  ```

#### `GET /api/v1/telemetry/logs`
Retrieve recent system events and telemetry logs.
* **Authentication**: Required
* **Response (200 OK)**:
  ```json
  {
    "logs": [
      {
        "id": "log-170000000",
        "timestamp": "10:15:23.001",
        "level": "INFO",
        "service": "dashboard-go",
        "message": "Token validation succeeded for sub=kc-user-oidc",
        "time": "2026-08-02T10:15:23.001Z"
      }
    ],
    "total": 1
  }
  ```

---

### 3. User Profile Endpoints

#### `GET /api/v1/profile/me`
Retrieve user profile details. Automatically provisions a local profile using JWT claims if it doesn't exist yet.
* **Authentication**: Required
* **Response (200 OK)**:
  ```json
  {
    "id": "user-sub-uuid",
    "username": "user",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "avatar_url": "https://avatar.url"
  }
  ```

#### `PUT /api/v1/profile/me`
Update the logged-in user profile details (synchronized to database and Keycloak Admin API).
* **Request Body DTO**:
  ```json
  {
    "first_name": "Jane",
    "last_name": "Doe",
    "avatar_url": "https://avatar-new.url"
  }
  ```
* **Response (200 OK)**: Updated profile object.

---

### 4. Health Check Routes

#### `GET /healthz`
Liveness probe.
* **Authentication**: None
* **Response (200 OK)**:
  ```json
  {"status":"healthy","service":"dashboard-backend"}
  ```

#### `GET /readyz`
Readiness probe. Verifies PostgreSQL DB database pool connection.
* **Authentication**: None
* **Response (200 OK)**:
  ```json
  {"status":"ready","database":"connected"}
  ```

---

## 🐳 Environment Variables Setup
The backend parses the following configuration environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port the Go server listens on |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/dashboard_db?sslmode=disable` | Database connection string |
| `KEYCLOAK_BASE_URL` | `http://localhost:8080` | Root URL for internal Keycloak service |
| `KEYCLOAK_REALM` | `loeger-os` | Realm identifier |
| `KEYCLOAK_CLIENT_ID` | `dashboard-backend` | Service account client ID |
| `KEYCLOAK_JWKS_URL` | *(derived)* | Specific Cert endpoint (`BaseURL/realms/Realm/protocol/openid-connect/certs`) |
