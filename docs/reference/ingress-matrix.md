# Caddy Gateway Ingress & Routing Matrix (`docs/reference/ingress-matrix.md`)

> **TL;DR:** Master routing specification for the central Caddy reverse-proxy gateway (`infrastructure/caddy`), defining public domains, subpath mappings, and backend path stripping rules.

---

## 📋 Table of Contents
- [Gateway Overview & Domains](#gateway-overview--domains)
- [Frontend Domain Routing (`alfheim.loegien.localhost`)](#frontend-domain-routing-alfheimloegienlocalhost)
- [API Gateway Domain Routing (`api.alfheim.loegien.localhost`)](#api-gateway-domain-routing-apialfheimloegienlocalhost)
- [Caddy Path Stripping Rules (`handle_path`)](#caddy-path-stripping-rules-handle_path)

---

## Gateway Overview & Domains

Traffic entering Alfheim passes through a central Caddy ingress proxy (`infrastructure/caddy`).

* **Frontend Domain**: `alfheim.loegien.de` / `alfheim.loegien.localhost`
* **API Gateway Domain**: `api.alfheim.loegien.de` / `api.alfheim.loegien.localhost`

---

## Frontend Domain Routing (`alfheim.loegien.localhost`)

| Public URL Path | Target Container | Container Port | BasePath Redirect / Notes |
| :--- | :--- | :--- | :--- |
| `http://alfheim.loegien.localhost/` | `dashboard-frontend` | `3000` | Root platform dashboard landing page |
| `http://alfheim.loegien.localhost/pantry` | `pantry-frontend` | `3000` | Redirects bare `/pantry` to `/pantry/en` |
| `http://alfheim.loegien.localhost/budget` | `budget-frontend` | `3000` | Redirects bare `/budget` to `/budget/en` |
| `http://alfheim.loegien.localhost/chores` | `chores-frontend` | `3000` | Redirects bare `/chores` to `/chores/de` |
| `http://alfheim.loegien.localhost/workout` | `workout-frontend` | `3000` | Redirects bare `/workout` to `/workout/de` |
| `http://alfheim.loegien.localhost/library` | `library-frontend` | `3000` | Redirects bare `/library` to `/library/en` |
| `http://alfheim.loegien.localhost/maintenance`| `maintenance-frontend`| `3000`| Redirects bare `/maintenance` to `/maintenance/en` |
| `http://alfheim.loegien.localhost/shopping` | `shopping-frontend` | `3010` | Redirects bare `/shopping` to `/shopping/en` |
| `http://alfheim.loegien.localhost/chat` | `chat-frontend` | `3000` | Redirects bare `/chat` to `/chat/de` |
| `http://alfheim.loegien.localhost/grafana` | `grafana` | `3000` | Zitadel SSO Observability Dashboard |

---

## API Gateway Domain Routing (`api.alfheim.loegien.localhost`)

| Public API URL Path | Target Container | Container Port | Path Stripping Rule |
| :--- | :--- | :--- | :--- |
| `http://auth.alfheim.loegien.localhost/` | `zitadel` | `8080` | Dedicated IAM host. Zitadel does not support sub-path hosting; proxied over h2c. |
| `http://api.alfheim.loegien.localhost/storage/` | `rustfs` | `9000` | Strips `/storage` prefix |
| `http://api.alfheim.loegien.localhost/pantry/api/v1/` | `pantry-backend` | `8000` | Strips `/pantry` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/budget/api/v1/` | `budget-backend` | `8000` | Strips `/budget` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/shopping/api/v1/`| `shopping-backend`| `8000` | Strips `/shopping` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/maintenance/api/v1/`| `maintenance-backend`| `8000`| Strips `/maintenance` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/workout/api/v1/`| `workout-backend` | `8000` | Strips `/workout` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/library/api/v1/`| `library-backend` | `8000` | Strips `/library` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/api/v1/chores` | `chores-backend` | `8000` | Native route (no stripping) |
| `http://api.alfheim.loegien.localhost/api/v1/chat` | `chat-backend` | `8080` | Native Go API route (no stripping) |
| `http://api.alfheim.loegien.localhost/api/v1/apps` | `dashboard-backend` | `8080` | Native Go API route (no stripping) |

---

## Caddy Path Stripping Rules (`handle_path`)

Python FastAPI microservices mount REST routers natively at `/api/v1`. To allow routing under service subpaths (e.g. `api.alfheim.loegien.localhost/pantry/api/v1/items`), Caddy uses `handle_path` blocks:

```caddy
@pantry_api path /pantry/*
handle_path /pantry/* {
    reverse_proxy pantry-backend:8000
}
```

This strips `/pantry` before forwarding HTTP traffic to `pantry-backend:8000`, so the backend receives `/api/v1/items`.
