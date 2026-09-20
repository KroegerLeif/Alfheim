---
title: "Umgebungsvariablen Referenz"
description: "Erschöpfende Referenz der in der gesamten Alfheim-Infrastruktur, Kerndiensten und Microservice-Anwendungen verwendeten Umgebungsvariablen."
sidebar:
  label: "Umgebungsvariablen"
---

> **Kurzfassung:** Erschöpfende Referenz der in der gesamten Alfheim-Infrastruktur, Kerndiensten und Microservice-Anwendungen verwendeten Umgebungsvariablen.

---

## 📋 Inhaltsverzeichnis
- [Root-Plattformkonfiguration](#root-plattformkonfiguration)
- [Identität & Zugriffsverwaltung (Generisches OIDC & Zitadel)](#identität--zugriffsverwaltung-generisches-oidc--zitadel)
- [Objektspeicher (RustFS S3)](#objektspeicher-rustfs-s3)
- [Beobachtungs-Stack (VictoriaStack & Telemetrie)](#beobachtungs-stack-victoriastack--telemetrie)
- [Microservice-Backend-Variablen](#microservice-backend-variablen)
- [Haushalts- & Rollendienst (`core/household`)](#haushalts---rollendienst-corehousehold)
- [Microfrontend-Umgebungsvariablen](#microfrontend-umgebungsvariablen)

---

## Root-Plattformkonfiguration

Zentral konfiguriert in Root `.env` (generiert aus `.env.example` via `./scripts/init-env.sh`):

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `ALFHEIM_BASE_URL` | `https://alfheim.loegien.de` | Öffentliche Root-Domain für Frontend-Ingress |
| `ALFHEIM_HOST` | `alfheim.loegien.de` | Kanonischer Hostname für die Hauptanwendung |
| `DOMAIN` | `loegien.de` | Root-Domain für alle Dienste |
| `IMAGE_REGISTRY` | `ghcr.io` | Container-Image-Registry |
| `IMAGE_REPO` | `kroegerleif/alfheim` | Container-Image-Repository |
| `IMAGE_TAG` | `latest` | Container-Image-Tag |
| `CADDY_TLS_DIRECTIVE` | _(leer)_ | Optional Caddy-TLS-Override (`tls internal` für lokal signiertes HTTPS; leer lassen für Auto-HTTPS) |
| `ALFHEIM_EXTRA_CA_FILE` | _(leer)_ | Pfad im Container zu einem PEM-Bundle zusätzlicher Root-CAs, denen serverseitige OIDC-Clients (Python-Backends, Go-Backends von Dashboard und Chat, Grafana über `GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_CA`) **zusätzlich** zu den System-Roots vertrauen. Der Installer setzt `/etc/alfheim/ca/alfheim-root-ca.crt` für die TLS-Strategie `internal` (Host-Verzeichnis `infrastructure/ca/`, schreibgeschützt eingebunden) und lässt ihn sonst leer. Eine unlesbare oder Nicht-PEM-Datei wird als Fehler mit dem Pfad gemeldet, nie stillschweigend ignoriert |

---

## Identität & Zugriffsverwaltung (Generisches OIDC & Zitadel)

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `OIDC_ISSUER_URL` | `https://auth.loegien.de` | Öffentlicher OIDC-Aussteller: die Basis-URL des IAM-Hosts |
| `OIDC_INTERNAL_URL` | `http://zitadel:8080` | Interne Basis-URL für Server-zu-Server-OIDC-Aufrufe (bleibt im Container-Netzwerk) |
| `OIDC_AUDIENCE` | `alfheim` | Ziel-OIDC-Client-ID / Audience für Backend-Token-Validierung |
| `ZITADEL_MASTERKEY` | *(Generierter 32-Byte-Schlüssel)* | Verschlüsselungs-Master-Key für Zitadel-Initialisierung (muss genau 32 Zeichen sein; generieren Sie mit `openssl rand -hex 16`) |
| `ZITADEL_EXTERNALDOMAIN` | `auth.loegien.de` | Öffentlicher Hostname für Zitadel-OIDC-Endpunkte |
| `ZITADEL_EXTERNALPORT` | `443` | Öffentlicher Port für Zitadel (typischerweise 443 für HTTPS oder 80 für HTTP) |
| `ZITADEL_EXTERNALSECURE` | `true` | Ob Zitadel via HTTPS zugänglich ist (auf `true` in Produktion setzen) |
| `ZITADEL_ADMIN_USER` | `admin` | Zitadel-Initial-Administrator-Benutzername |
| `ZITADEL_ADMIN_PASSWORD` | `Password1!` | Zitadel-Verwaltungsbenutzer-Passwort (neu generiert von `scripts/init-env.sh` für Produktion) |
| `ZITADEL_DB_HOST` | `postgres-core` | Zitadel-Datenbank-Host |
| `ZITADEL_DB_PORT` | `5432` | Zitadel-Datenbank-Port |
| `ZITADEL_DB_NAME` | `zitadel` | Zitadel-Datenbankname |
| `ZITADEL_DB_USER` | `zitadel_user` | Zitadel-Datenbankbenutzer |
| `ZITADEL_DB_PASSWORD` | `postgres` | Zitadel-Datenbankpasswort |

---

## Objektspeicher (RustFS S3)

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `S3_ENDPOINT_URL` | `http://rustfs:9000` | S3-kompatibler Objektspeicher-Endpunkt (verwendet von Python-Backends) |
| `S3_ENDPOINT` | `http://rustfs:9000` | S3-kompatibler Objektspeicher-Endpunkt (verwendet von Go-Chat-Backend) |
| `S3_PUBLIC_URL` | `https://alfheim.loegien.de/storage` | Öffentliches URL-Präfix für den Zugriff auf gespeicherte Objekte im Browser |
| `S3_BUCKET_NAME` | `budget-receipts` | Standard-Bucket für Budget-Quittungs-Uploads |
| `S3_ACCESS_KEY` | `minioadmin` | S3-Zugangsschlüssel-ID (RustFS-Anmeldedaten) |
| `S3_SECRET_KEY` | `minioadmin` | S3-geheimer Zugangsschlüssel (RustFS-Anmeldedaten) |
| `S3_ROOT_USER` | `minioadmin` | RustFS-Root-Benutzer (Initial-Admin) |
| `S3_ROOT_PASSWORD` | `minioadmin` | RustFS-Root-Passwort |

---

## Beobachtungs-Stack (VictoriaStack & Telemetrie)

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4317` | OTLP-gRPC-Endpunkt für Metriken- und Trace-Export |
| `OTEL_EXPORTER_OTLP_INSECURE` | `true` | Unverschlüsselte OTLP-Verbindungen zulassen (auf `false` für TLS setzen) |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana-Initial-Admin-Benutzername |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana-Initial-Admin-Passwort |
| `GRAFANA_OIDC_CLIENT_ID` | `alfheim-grafana` | Zitadel-OIDC-Client-ID für Grafana-SSO |
| `GRAFANA_OIDC_CLIENT_SECRET` | _(auto-provisioned)_ | Zitadel-OIDC-Client-Secret für Grafana-SSO (gesetzt von `alfheim-setup provision` / dem Provisioning-Schritt des Installers) |

---

## Microservice-Backend-Variablen

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `{SERVICE}_DATABASE_URL` | _(konstruiert)_ | Explizite PostgreSQL-Verbindungszeichenkette für einen Dienst (z.B. `DASHBOARD_DATABASE_URL`, `PANTRY_DATABASE_URL`); wenn leer, konstruieren Dienste sie aus `{SERVICE}_POSTGRES_*`-Variablen |
| `CHAT_ENCRYPTION_KEY` | _(leer)_ | AES-256-GCM-Schlüssel (Base64-codiert) zum Verschlüsseln gespeicherter LLM-API-Schlüssel und Anmeldedaten |
| `CHAT_ENCRYPTION_KEY_ID` | `v1` | Versions-ID für den Verschlüsselungsschlüssel (für Schlüsselrotation verwendet) |
| `CHAT_MCP_SERVERS` | `pantry=http://pantry-backend:8000/mcp,chores=http://chores-backend:8000/mcp,maintenance=http://maintenance-backend:8000/mcp` | Kommagetrennte MCP-Server-Definitionen für den Chat-Assistenten |
| `PANTRY_BACKEND_URL` | `http://pantry-backend:8000` | Interne URL für Shopping-List-Dienst zum Erreichen der Speisekammer-Inventar-API |
| `GOOGLE_BOOKS_API_KEY` | _(leer)_ | Google Books API-Schlüssel für Bibliotheks-Metadaten-Anreicherung (optional; leer lassen zum Deaktivieren) |
| `TMDB_API_KEY` | _(leer)_ | The Movie Database API-Schlüssel für Bibliotheks-Medien-Metadaten-Anreicherung (optional; leer lassen zum Deaktivieren) |

---

## Haushalts- & Rollendienst (`core/household`)

Tier-1-Kerndienst, dem Haushalte und Mitgliederrollen gehören. `compose.prod.yaml` betreibt ihn als `household-backend` (Go, Port `8080`, Health-Check `GET /healthz`) und `household-frontend` (Next.js, Port `3000`, basePath `/household`). Das Frontend erhält dieselben Variablen wie `dashboard-frontend` (`NEXT_PUBLIC_OIDC_ISSUER`, `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID` aus `ALFHEIM_WEB_CLIENT_ID`, `ALFHEIM_BASE_URL`).

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `HOUSEHOLD_POSTGRES_USER` | `household_user` | Datenbankrolle des Household-Backends |
| `HOUSEHOLD_POSTGRES_PASSWORD` | `postgres` | Passwort von `household_user`. `alfheim-setup` erzeugt einen zufälligen Wert mit 32 Zeichen; ein einfaches Day-2-Update ergänzt ihn in einer älteren `.env`, ohne bestehende Secrets anzufassen |
| `HOUSEHOLD_POSTGRES_DB` | `alfheim_household` | Datenbank des Household-Backends, angelegt von `infrastructure/postgres/init-multiple-dbs.sh` |
| `HOUSEHOLD_DATABASE_URL` | _(konstruiert)_ | Optionale vollständige Verbindungszeichenkette; wenn leer, baut `compose.prod.yaml` `postgres://household_user:…@postgres-core:5432/alfheim_household?sslmode=disable` |
| `ALFHEIM_INTERNAL_TOKEN` | `change-me-internal-token` | Gemeinsames Secret für Service-zu-Service-Aufrufe an die `/internal/*`-API des Household-Backends. `alfheim-setup` erzeugt 32 Zufallsbytes (64 Hex-Zeichen) und erzeugt einen vorhandenen Wert nie neu. Caddy routet `/internal/*` nie (Antwort `404` auf beiden Hosts). `household-backend` prüft den Wert; alle sieben Python-App-Backends (pantry, shopping, chores, maintenance, budget, workout, library) und `chat-backend` erhalten ihn und senden ihn bei Mitgliedschaftsprüfungen als `Authorization: Bearer …`. `compose.prod.yaml` verlangt ihn; die Dev-Compose-Dateien fallen auf `dev-internal-token-change-me` zurück (`scripts/init-env.sh` erzeugt einen Zufallswert) |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL, die die App-Backends und `chat-backend` für `GET /internal/v1/memberships/{householdId}/{userSub}` verwenden. Aufgelöst über `gateway-net`, dem `household-backend` und jeder Konsument beitreten. Jeder Konsument wartet, bis `household-backend` healthy ist, bevor er startet |

---

## Frontend-Umgebungsvariablen

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://alfheim.loegien.de` | Browser-zugängliche Frontend-Root-URL |
| `NEXT_PUBLIC_OIDC_ISSUER` | `https://auth.loegien.de` | Browser-seitige OIDC-Aussteller für den PKCE-Autorisierungs-Code-Flow |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | `dashboard-frontend` | Zitadel-OIDC-Client-ID für das Dashboard-Frontend (andere Frontends können unterschiedliche IDs verwenden) |
| `NEXT_PUBLIC_OIDC_REDIRECT_URI` | `https://alfheim.loegien.de/` | OAuth2-Redirect-URI für das Dashboard-Frontend |
| `NEXT_PUBLIC_API_URL` | _(abgeleitet)_ | Browser-API-Basis-URL jedes Frontends. Nicht in der `.env` gesetzt: Compose leitet sie aus `ALFHEIM_BASE_URL` als Build-Argument und Laufzeit-Umgebung ab, mit der Same-Origin-Caddy-Route, die der Client der App erwartet (siehe unten). `scripts/init-env.sh` entfernt die alten Einträge `NEXT_PUBLIC_*_API_URL` pro App und `NEXT_PUBLIC_API_GATEWAY_URL` aus einer bestehenden `.env` |

Abgeleitete `NEXT_PUBLIC_API_URL` pro Frontend:

| Frontend | Wert |
| :--- | :--- |
| `dashboard-frontend`, `household-frontend` | `${ALFHEIM_BASE_URL}/api/v1` |
| `pantry-frontend` | `${ALFHEIM_BASE_URL}/pantry/api/v1` |
| `shopping-frontend` | `${ALFHEIM_BASE_URL}/shopping/api/v1` |
| `chores-frontend`, `budget-frontend`, `chat-frontend`, `maintenance-frontend`, `workout-frontend`, `library-frontend` | `${ALFHEIM_BASE_URL}/api/v1/<app>` |

Im Entwicklungs-Stack liest `household-frontend` stattdessen `NEXT_PUBLIC_HOUSEHOLD_API_URL` (Standard `http://api.alfheim.loegien.localhost/api/v1`).

---

## ACME & TLS-Konfiguration

Automatische TLS-Zertifikat-Ausstellung via Let's Encrypt. Siehe `docs/en/how-to/hetzner-dns-tls.md` für Setup-Anleitung.

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `ACME_EMAIL` | _(leer)_ | E-Mail-Adresse für ACME-Zertifikat-Benachrichtigungen und Wiederherstellung; **erforderlich** für automatisches HTTPS |
| `HETZNER_API_TOKEN` | _(leer)_ | Hetzner DNS API-Token für DNS-01-Challenges (erforderlich wenn Hetzner DNS verwendet wird) |
| `CLOUDFLARE_API_TOKEN` | _(leer)_ | Cloudflare API-Token für DNS-01-Challenges (erforderlich wenn Cloudflare DNS verwendet wird) |

---

## PostgreSQL-Datenbankberechtigungen

Microservice-spezifische Datenbankbenutzer und Datenbanken, erstellt auf dem gemeinsamen `postgres-core`-Container:

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `postgres` | PostgreSQL-Superbenutzer (verwendet für Initial-Setup) |
| `POSTGRES_PASSWORD` | `super_secret_local_password` | PostgreSQL-Superbenutzer-Passwort |
| `POSTGRES_DB` | `postgres` | Standard-PostgreSQL-Datenbankname |
| `{SERVICE}_POSTGRES_USER` | `{service}_user` | Datenbankbenutzer für einen Dienst (z.B. `DASHBOARD_POSTGRES_USER`) |
| `{SERVICE}_POSTGRES_PASSWORD` | `postgres` | Datenbankpasswort für einen Dienst |
| `{SERVICE}_POSTGRES_DB` | `alfheim_{service}` | Datenbankname für einen Dienst |
