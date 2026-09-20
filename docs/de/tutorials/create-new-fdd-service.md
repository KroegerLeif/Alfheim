---
title: "Neuen FDD-Microservice erstellen"
description: "Schritt-für-Schritt-Anleitung zum Aufsetzen, Implementieren und Registrieren eines neuen Feature-Driven-Design-Microservices im Alfheim-Monorepo."
---

> **Kurzfassung:** Schritt-für-Schritt-Anleitung zum Aufsetzen, Implementieren und Registrieren eines neuen Feature-Driven-Design-Microservices (FDD) im Alfheim-Monorepo.

---

## 📋 Inhalt
- [Überblick](#überblick)
- [Schritt 1: Verzeichnisstruktur anlegen](#schritt-1-verzeichnisstruktur-anlegen)
- [Schritt 2: Backend-Fachdomänen implementieren](#schritt-2-backend-fachdomänen-implementieren)
- [Schritt 3: Microfrontend implementieren](#schritt-3-microfrontend-implementieren)
- [Schritt 4: Dienst in Caddy & Dashboard registrieren](#schritt-4-dienst-in-caddy--dashboard-registrieren)
- [Schritt 5: Tests schreiben & Quality Gates prüfen](#schritt-5-tests-schreiben--quality-gates-prüfen)

---

## Überblick

Ein neuer Microservice unter `apps/<neue-app>` besteht aus einem FastAPI- (oder Go-) Backend und einem Next.js-16-Microfrontend. Dieses Tutorial legt beispielhaft einen Dienst namens `recipes` an.

---

## Schritt 1: Verzeichnisstruktur anlegen

1. Anwendungsverzeichnisse unter `apps/recipes/` erstellen:
   ```bash
   mkdir -p apps/recipes/backend/src/features/catalog
   mkdir -p apps/recipes/frontend/src/app/[locale]
   ```

2. `apps/recipes/compose.yml` anlegen und darin Backend- und Frontend-Dienste definieren. Neue
   Apps bekommen keinen eigenen Datenbank-Container: Sie teilen sich den konsolidierten
   `postgres-core`-Cluster, wie `budget` und `library`. `recipes` zum `SERVICES`-Array in
   `infrastructure/postgres/init-multiple-dbs.sh` hinzufügen
   (`"alfheim_recipes:${RECIPES_POSTGRES_USER:-recipes_user}:${RECIPES_POSTGRES_PASSWORD:-postgres}"`),
   damit Datenbank und Least-Privilege-Eigentümer idempotent angelegt werden, und `DATABASE_URL`
   auf `postgres-core:5432/alfheim_recipes` verweisen lassen.

---

## Schritt 2: Backend-Fachdomänen implementieren

Feature-Driven Design (FDD) in `apps/recipes/backend/src/features/catalog/` umsetzen:

1. SQLModel-Datenbanktabellen in `models.py` definieren.
2. Pydantic-Request-/Response-Modelle in `schemas.py` definieren.
3. Fachlogik in `service.py` implementieren.
4. FastAPI-REST-Routen in `router.py` anlegen, wobei jede haushaltsbezogene Route von
   `backend_shared.household.require_household` abhängt (oder `require_role(...)`, wenn eine
   Route eine bestimmte Rolle braucht). Niemals `X-Household-ID` oder einen JWT-Haushalts-/Rollen-Claim
   selbst parsen – Zitadel stellt keinen von beidem aus. `configure_household_auth(settings)` in
   `main.py` aufrufen und `await close_membership_client()` beim Shutdown. Siehe
   [ADR 0006](../explanation/decisions/0006-household-authorization-via-membership-api.md) und
   [.ai/guidelines/new-app-scaffolding.md](../../../.ai/guidelines/new-app-scaffolding.md).
5. Öffentliche Schnittstellen in `__init__.py` explizit exportieren:
   ```python
   # src/features/catalog/__init__.py
   from .models import Recipe
   from .service import RecipeService

   __all__ = ["Recipe", "RecipeService"]
   ```
6. Die eigene `HOUSEHOLD_INTERNAL_URL` der App (Standard `http://household-backend:8080`) und
   `ALFHEIM_INTERNAL_TOKEN` in `compose.yml` und `compose.prod.yaml` verdrahten, und das Backend
   von einem gesunden `household-backend` abhängig machen. Ohne ein gültiges, übereinstimmendes
   `ALFHEIM_INTERNAL_TOKEN` schlägt jede haushaltsbezogene Anfrage geschlossen mit
   `503 household_service_unavailable` fehl.

---

## Schritt 3: Microfrontend implementieren

1. Next.js App Router in `apps/recipes/frontend/src/app/[locale]/page.tsx` konfigurieren.
2. Geteilte UI-Primitive aus `@alfheim/shared` importieren, einschließlich `HouseholdProvider`
   (von der gemeinsamen `AppShell` gemountet) und `HouseholdGate`, hinter dem jede
   haushaltsbezogene Seite gerendert wird. `useActiveHousehold()` für die aktive Haushalts-ID
   verwenden – niemals `localStorage.alfheim_active_household_id` direkt lesen – und sie in jeden
   haushaltsbezogenen TanStack-Query-Key aufnehmen.
3. Bei API-Aufrufen nur `X-Household-ID` senden (via `applyHouseholdHeaders`, niemals
   `X-Household-Role`) und Haushalts-Fehler mit `reportHouseholdErrorResponse` melden.
4. Die strikte Grenze von 200 Codezeilen (LOC) pro `.tsx`-Datei einhalten.

---

## Schritt 4: Dienst in Caddy & Dashboard registrieren

1. **Caddy-Ingress**: Sowohl eine Frontend- als auch eine API-Route in
   `infrastructure/caddy/Caddyfile` ergänzen, nach dem bestehenden Muster pro App (siehe die
   Einträge für `budget` oder `library`). Auf der Frontend-Domain:
   ```caddy
   redir /recipes /recipes/en 302
   redir /recipes/ /recipes/en 302

   handle /recipes* {
       reverse_proxy recipes-frontend:3000
   }

   handle_path /api/v1/recipes* {
       rewrite * /api/v1/recipes{path}
       reverse_proxy recipes-backend:8000
   }
   handle_path /recipes/api/v1* {
       rewrite * /api/v1/recipes{path}
       reverse_proxy recipes-backend:8000
   }
   ```
   Das passende native + präfix-strippende Alias auch auf der `api.*`-API-Gateway-Domain
   ergänzen (siehe [Ingress-Matrix](../reference/ingress-matrix.md)).

2. **Control-Plane-Registry**: `recipes` in `core/dashboard/backend/internal/features/apps/tier1_core_registry.go` registrieren.
3. **Anwendungskatalog**: `recipes` im [Anwendungskatalog](../reference/apps-catalog.md) ergänzen.
4. **Referenzseite**: `docs/de/reference/apps/recipes.md` anlegen (Zweck, Routen,
   Umgebungsvariablen, Haushalts-Scoping, MCP-Tools falls vorhanden, bekannte Probleme) – siehe
   eine bestehende App-Referenzseite für die erwartete Form.

---

## Schritt 5: Tests schreiben & Quality Gates prüfen

1. Pytest-Backend-Tests in `apps/recipes/backend/src/features/catalog/tests/` schreiben,
   einschließlich einer Haushalts-Isolations-Suite
   (`backend_shared.household.testing.override_membership`), die belegt, dass Mandant A nicht die
   Daten von Mandant B lesen, schreiben oder löschen kann, und die `403 household_forbidden` /
   `400 household_required` / `503 household_service_unavailable` abdeckt.
2. Workspace-Verifikation ausführen:
   ```bash
   ./scripts/verify.sh --python --frontend
   ```
