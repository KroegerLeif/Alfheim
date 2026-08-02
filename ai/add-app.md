# Adding a New App Routing & Ingress Blueprint (`ai/add-app.md`)

This guideline defines the modernized standard for registering and exposing new applications/services in the `loeger-os` monorepo using Traefik v3 ingress routing and Keycloak authentication.

---

## 1. Network Architecture
All microservices and frontend applications that need external HTTP entry exposure must connect to the global `public-ingress` Docker bridge network.

In your application's `compose.yml`, declare the network as external:
```yaml
networks:
  public-ingress:
    name: public-ingress
    external: true
  # App-internal networks (if any) are owned by the local stack:
  app-internal:
    name: app-internal
```

---

## 2. Traefik v3 Routing Labels
Traefik dynamic routing is configured via Docker labels directly on your application containers.

### 2.1 Backend Routing
Backends should be exposed on path prefix `/api/v1/<app-name>`. Since Go/Python frameworks usually route internally using `/api/v1/...` directly, use a path-regex rewrite middleware to strip the namespace:

```yaml
services:
  app-backend:
    image: loeger-os/app-backend:latest
    networks:
      - public-ingress
      - app-internal
    labels:
      - "traefik.enable=true"
      # Match route rule
      - "traefik.http.routers.app-backend.rule=Host(`loeger-os`) && PathPrefix(`/api/v1/app-name`)"
      - "traefik.http.routers.app-backend.entrypoints=web"
      - "traefik.http.routers.app-backend.service=app-backend-service"
      - "traefik.http.routers.app-backend.middlewares=app-backend-regex"
      
      # Middleware regex path rewrite (stripping namespace from url structure)
      - "traefik.http.middlewares.app-backend-regex.replacepathregex.regex=^/api/v1/app-name/(api/v1/)?(.*)"
      - "traefik.http.middlewares.app-backend-regex.replacepathregex.replacement=/api/v1/$$2"
      
      # Internal port loadbalancer
      - "traefik.http.services.app-backend-service.loadbalancer.server.port=8080"
```

### 2.2 Frontend Routing
Frontends must use `basePath: '/app-name'` (Next.js config) and route path prefix `/<app-name>`:

```yaml
services:
  app-frontend:
    image: loeger-os/app-frontend:latest
    networks:
      - public-ingress
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app-frontend.rule=Host(`loeger-os`) && PathPrefix(`/app-name`)"
      - "traefik.http.routers.app-frontend.entrypoints=web"
      - "traefik.http.routers.app-frontend.service=app-frontend-service"
      
      # Handle redirect to locale to avoid 404s on bare domain prefix
      - "traefik.http.routers.app-exact.rule=Host(`loeger-os`) && (Path(`/app-name`) || Path(`/app-name/`))"
      - "traefik.http.routers.app-exact.entrypoints=web"
      - "traefik.http.routers.app-exact.service=app-frontend-service"
      - "traefik.http.routers.app-exact.middlewares=app-redirect-locale"
      - "traefik.http.middlewares.app-redirect-locale.redirectregex.regex=^(https?://[^/]+)/app-name/?$$"
      - "traefik.http.middlewares.app-redirect-locale.redirectregex.replacement=$${1}/app-name/de"
      - "traefik.http.middlewares.app-redirect-locale.redirectregex.permanent=false"
      
      - "traefik.http.services.app-frontend-service.loadbalancer.server.port=3000"
```

---

## 3. Registering via Dynamic File Provider (`dynamic.yml`)
For external portals, integrations, or services that cannot be directly declared with container labels, define custom routing rules inside the Traefik dynamic configuration file `infrastructure/traefik/dynamic/dynamic.yml`:

```yaml
http:
  routers:
    external-service-router:
      rule: "Host(`loeger-os`) && PathPrefix(`/external-path`)"
      service: external-service
      entryPoints:
        - web
      middlewares:
        - security-headers

  services:
    external-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.100:9000"
```

---

## 4. Keycloak Client Integration
Every frontend and backend requires OIDC client credentials/public profiles in Keycloak:

1. **Frontend App Registration**:
   - Register a client in `loeger-os` realm named `<app-name>-frontend`.
   - Configure Access Type: `Public` (Standard authorization flow with PKCE enabled).
   - Valid Redirect URIs: `http://loeger-os/<app-name>/*`
   - Web Origins: `*`

2. **Backend JWT Verification**:
   - Backends validate incoming bearer tokens by downloading public JWKS keys.
   - Set the following environment variables:
     ```env
     KEYCLOAK_BASE_URL=http://keycloak:8080/auth
     KEYCLOAK_REALM=loeger-os
     ```
   - Standard OIDC configuration translates this base URL to the internal certifications endpoint:
     `http://keycloak:8080/auth/realms/loeger-os/protocol/openid-connect/certs`
