# Maintenance App Architecture — WHY (`apps/maintenance/`)

This directory houses the **Maintenance & Device Inventory Service** for the `loeger-os` monorepo. It manages the registration of household devices, coordinates recurring maintenance schedules, runs interactive guided maintenance checklists, and tracks historical service events.

---

## 🛠️ System Overview & Architecture

The application is split into two major FDD-structured tiers served through the Traefik proxy gateway:

```mermaid
graph TD
    User([User Agent]) -->|/maintenance| Ingress[Traefik Ingress Proxy]
    User -->|/api/v1/maintenance| Ingress
    Ingress -->|Port 3000| Frontend[Next.js Frontend Container]
    Ingress -->|Port 8000| Backend[FastAPI Backend Container]
    Backend -->|Port 5432| DB[(PostgreSQL maintenance-db)]
    Backend -->|OIDC Token Check| IAM[Keycloak Service]
```

### 1. Ingress Mapping (Traefik Gateway)
* **Frontend**: Mapped to host URL prefix `/maintenance`.
* **Backend**: Mapped to host URL prefix `/api/v1/maintenance`. Traefik strips the prefix route and rewrites requests to `/api/v1/...` at the FastAPI level.

### 2. Dependency Services
* **Database**: Runs on PostgreSQL (`maintenance-db`). Managed using SQLModel (SQLAlchemy) async sessions.
* **Authentication**: Integrates with Keycloak OIDC. Bearer JWT tokens are validated via the `get_current_user_and_household` dependency injected into FastAPI endpoints.

---

## 🚀 Getting Started

To spin up the Maintenance App along with its dependencies locally:

```bash
# Start Keycloak and Ingress infrastructure
./infrastructure/up.sh

# Start the maintenance database, backend, and frontend containers
./scripts/up.sh maintenance
```
