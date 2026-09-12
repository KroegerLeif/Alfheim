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

2. `apps/recipes/compose.yml` anlegen und darin den eigenen Datenbank-Container (`recipes-db`) sowie Backend- und Frontend-Dienste definieren.

---

## Schritt 2: Backend-Fachdomänen implementieren

Feature-Driven Design (FDD) in `apps/recipes/backend/src/features/catalog/` umsetzen:

1. SQLModel-Datenbanktabellen in `models.py` definieren.
2. Pydantic-Request-/Response-Modelle in `schemas.py` definieren.
3. Fachlogik in `service.py` implementieren.
4. FastAPI-REST-Routen in `router.py` anlegen.
5. Öffentliche Schnittstellen in `__init__.py` explizit exportieren:
   ```python
   # src/features/catalog/__init__.py
   from .models import Recipe
   from .service import RecipeService

   __all__ = ["Recipe", "RecipeService"]
   ```

---

## Schritt 3: Microfrontend implementieren

1. Next.js App Router in `apps/recipes/frontend/src/app/[locale]/page.tsx` konfigurieren.
2. Geteilte UI-Primitive aus `@alfheim/shared` importieren.
3. Die strikte Grenze von 200 Codezeilen (LOC) pro `.tsx`-Datei einhalten.

---

## Schritt 4: Dienst in Caddy & Dashboard registrieren

1. **Caddy-Ingress**: Reverse-Proxy-Regel in `infrastructure/caddy/Caddyfile` ergänzen:
   ```caddy
   handle_path /recipes/* {
       reverse_proxy recipes-backend:8000
   }
   ```

2. **Control-Plane-Registry**: `recipes` in `core/dashboard/backend/internal/features/apps/tier1_core_registry.go` registrieren.
3. **Anwendungskatalog**: `recipes` im [Anwendungskatalog](../../en/reference/apps-catalog.md) ergänzen.

---

## Schritt 5: Tests schreiben & Quality Gates prüfen

1. Pytest-Backend-Tests in `apps/recipes/backend/src/features/catalog/tests/` schreiben.
2. Workspace-Verifikation ausführen:
   ```bash
   ./scripts/verify.sh --python --frontend
   ```
