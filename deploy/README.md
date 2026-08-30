# Deployment Architecture

The `deploy/` directory manages platform deployment specifications, server-level configurations, and manifests for Tier 2 stack applications and external integrations.

---

## 1. Architectural Purpose

While individual microservices in `apps/` and `core/` manage their own containerized build context and local compose files, the `deploy/` directory provides centralized server-level configuration files and declarative application manifests.

---

## 2. Manifests & Files

```
deploy/
├── README.md               # Directory documentation
└── stack-apps.yaml         # Tier 2 stack applications and external integrations manifest
```

### Manifest Specifications (`stack-apps.yaml`):
The `stack-apps.yaml` file defines server-level stack applications (such as Home Assistant, Plex, and Nextcloud) integrated into the platform:

```yaml
apps:
  - id: "home-assistant"
    title: "Home Assistant"
    slug: "home-assistant"
    description: "Smart home automation, climate control, and security dashboard."
    icon: "home"
    url: "http://homeassistant.local"
    category: "external"
    required_roles: []
    status: "active"
    display_order: 1
```

### Fields:
* **`id` / `slug`**: Unique string identifier for routing and telemetry tagging.
* **`title` & `description`**: User-facing labels rendered on the dashboard landing page.
* **`url`**: External URL or relative route pointing to the target service.
* **`required_roles`**: Array of Keycloak OIDC roles required to access the application (e.g. `["admin"]`).
* **`status`**: Current deployment state (`active`, `in_progress`, or `deprecated`).
* **`display_order`**: Integer defining the rendering order in the dashboard apps grid.

---

## 3. Interactions with Other Layers

* **Core Control Plane (`core/dashboard/backend`)**: `dashboard-backend` reads `deploy/stack-apps.yaml` on startup to register Tier 2 external integrations alongside Tier 1 core applications.
* **Dashboard Frontend (`core/dashboard/frontend`)**: Displays filtered Tier 2 applications dynamically based on the user's authenticated OIDC roles.
* **Infrastructure Orchestration (`scripts/up.sh` & `compose.yaml`)**: Works in tandem with root Docker compose orchestration files to manage multi-container environment lifecycles.
