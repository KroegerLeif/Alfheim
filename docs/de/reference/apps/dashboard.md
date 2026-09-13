---
title: "Zentrales Dashboard-Kontrollzentrum"
description: "Zentrales Kontrollzentrum, Landing-Page-Launcher, Anwendungsregister, Haushaltsverwaltung und Telemetrie-Interface für die Alfheim-Plattform."
---

> **Kurzfassung:** Zentrales Kontrollzentrum, Landing-Page-Launcher, Anwendungsregister, Haushaltsverwaltung und Telemetrie-Interface für die Alfheim-Plattform.

Quelle: [`core/dashboard/`](https://github.com/KroegerLeif/Alfheim/tree/main/core/dashboard)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Einzelner Eingangspunkt für alle Home-Apps | Zentralisierter Dashboard-Launcher, der registrierte Microservices rendert |
| Gemischtes Ökosystem (Native vs. Homelab) | 3-Tier-Anwendungsregister (Native Kern-Apps, Stack YAML, Benutzer-Lesezeichen) |
| Multi-Haushalt-Verwaltung | Haushalt-Erstellung, Einladungs-Management und Mitglieds-Rollenausweisung |
| System-Gesundheits-Sichtbarkeit | Plattform-Telemetrie-Endpunkte für System-Metriken (CPU, RAM) und Logs |

---

## 🏛️ 3-Tier-Anwendungsregister-Architektur

Die Plattform organisiert Anwendungen, Portale und Lesezeichen in drei unterschiedliche architektonische Tiers:

1. **Tier 1 (Kern-Apps):** Native Monorepo-Microservices, registriert in Go (`internal/features/apps/tier1_core_registry.go`). Sichtbar für alle authentifizierten Benutzer; Sichtbarkeit kann pro Benutzer in `user_preferences` umgeschaltet werden.
2. **Tier 2 (Stack-Apps / Integrationen):** Externe Homelab-Stack-Anwendungen, konfiguriert via Server-level [`deploy/stack-apps.yaml`](../../../../deploy/stack-apps.yaml) und dynamisch nach OIDC-Rollen gefiltert.
3. **Tier 3 (Benutzer-Links):** Persönliche benutzerdefinierte Lesezeichen, gespeichert in PostgreSQL `user_links` (`GET/POST/PUT/DELETE /api/v1/user/links`).

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Go 1.25 REST API-Backend mit Chi-Router, PostgreSQL (`pgxpool`) und generischer OIDC (Zitadel) Bearer-Token-Middleware.
- **Frontend:** Next.js 16 (App Router) Microfrontend, Tailwind CSS v4, Lucide React und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_dashboard`-Datenbank, Besitzer `dashboard_user`).

### FDD Domain-Features (`internal/features/`)
- `apps`: Einheitliche 3-Tier-Anwendungsregister-Handler und YAML-Loader.
- `household`: Haushalt-Erstellung, Mitglied-Rollen-Management, Einladungs-Token-Generierung und Kontakt-Verzeichnis.
- `profile`: Just-In-Time-Benutzer-Profil-Bereitstellung von verifizierten OIDC-Token-Claims.
- `telemetry`: System-Metriken und Log-Abfragen.

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `dashboard-backend` | 8080 | `/api/v1/apps`, `/api/v1/households` | Go REST API Kontrollzentrum |
| `dashboard-frontend` | 3000 | `alfheim.loegien.localhost/` | Next.js Landing-Page-Kontrollzentrum |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://dashboard_user:postgres@postgres-core:5432/alfheim_dashboard?sslmode=disable` | PostgreSQL-Verbindungszeichenkette |
| `STACK_APPS_PATH` | `deploy/stack-apps.yaml` | Pfad zu Tier-2-Stack-Integrationen-Manifest |
| `OIDC_ISSUER_URL` | `https://auth.loegien.de` | Kanonischer OIDC-Aussteller; JWKS-URI wird aus seiner `/.well-known/openid-configuration` erkannt |
| `OIDC_AUDIENCE` | `alfheim` | Erforderlicher Wert im Token `aud`-Claim |
| `NEXT_PUBLIC_API_URL` | `http://api.alfheim.loegien.localhost` | Browser-API-Gateway-Endpunkt |

---

## 🗄️ Datenbankschema (PostgreSQL)

Das Go-Kontrollzentrum initialisiert drei Kern-Tabellen via SQL-Migrationen:
* `user_profiles`: Lokal synchronisierte Benutzerprofile von OIDC-Token-Claims (`id`, `email`, `username`, `first_name`, `last_name`).
* `user_preferences`: Benutzer-Dashboard-Einstellungen und versteckte Kern-App-IDs (`hidden_app_ids TEXT[]`).
* `user_links`: Persönliche benutzerdefinierte Lesezeichen (`title`, `url`, `icon`, `category`, `display_order`).

---
