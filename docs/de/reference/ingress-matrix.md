---
title: "Caddy-Gateway Ingress & Routing Matrix"
description: "Master-Routing-Spezifikation für das zentrale Caddy-Reverse-Proxy-Gateway (infrastructure/caddy), definiert öffentliche Domains, Subpath-Mappings und Backend-Pfad-Stripping-Regeln."
sidebar:
  label: "Ingress-Matrix"
---

> **Kurzfassung:** Master-Routing-Spezifikation für das zentrale Caddy-Reverse-Proxy-Gateway (`infrastructure/caddy`), definiert öffentliche Domains, Subpath-Mappings und Backend-Pfad-Stripping-Regeln.

---

## 📋 Inhaltsverzeichnis
- [Gateway-Übersicht & Domains](#gateway-übersicht--domains)
- [Frontend-Domain-Routing (`alfheim.loegien.localhost`)](#frontend-domain-routing-alfheimloegienlocalhost)
- [API-Gateway-Domain-Routing (`api.alfheim.loegien.localhost`)](#api-gateway-domain-routing-apialfheimloegienlocalhost)
- [Caddy-Pfad-Stripping-Regeln (`handle_path`)](#caddy-pfad-stripping-regeln-handle_path)

---

## Gateway-Übersicht & Domains

Traffic in Alfheim durchläuft einen zentralen Caddy-Ingress-Proxy (`infrastructure/caddy`).

* **Frontend-Domain**: `alfheim.loegien.de` / `alfheim.loegien.localhost`
* **API-Gateway-Domain**: `api.alfheim.loegien.de` / `api.alfheim.loegien.localhost`

Die Tabellen unten beschreiben den Entwicklungs-Stack (`scripts/up.sh`), der die `*.localhost`-Hosts über reines HTTP ausliefert. Chromium und Firefox behandeln `localhost`-Namen als sicheren Kontext, daher funktioniert die Anmeldung dort. Vom Installer erzeugte Deployments liefern jeden Host über HTTPS mit der bei der Installation gewählten Zertifikatsstrategie aus:

| TLS-Strategie | Zertifikate | Browser-Vertrauen |
| :--- | :--- | :--- |
| `hetzner`, `cloudflare` | Let's-Encrypt-Wildcard via DNS-01 | Vertraut |
| `custom` | Eigene PEM-Dateien | Hängt von der ausstellenden CA ab |
| `internal` (auch das LAN-Preset `.localhost`) | Signiert von der Root-CA des Installers (Caddy-CA-ID `alfheim`, Root schreibgeschützt eingebunden aus `infrastructure/caddy/pki/`) | Warnt, bis [der lokalen Root-CA vertraut wird](../how-to/trust-local-root-ca.md) |

---

## Frontend-Domain-Routing (`alfheim.loegien.localhost`)

| Öffentlicher URL-Pfad | Ziel-Container | Container-Port | BasePath-Redirect / Anmerkungen |
| :--- | :--- | :--- | :--- |
| `http://alfheim.loegien.localhost/` | `dashboard-frontend` | `3000` | Dashboard-Landesseite der Plattform |
| `http://alfheim.loegien.localhost/pantry` | `pantry-frontend` | `3000` | Leitet nacktes `/pantry` zu `/pantry/en` um |
| `http://alfheim.loegien.localhost/budget` | `budget-frontend` | `3000` | Leitet nacktes `/budget` zu `/budget/en` um |
| `http://alfheim.loegien.localhost/chores` | `chores-frontend` | `3000` | Leitet nacktes `/chores` zu `/chores/de` um |
| `http://alfheim.loegien.localhost/workout` | `workout-frontend` | `3000` | Leitet nacktes `/workout` zu `/workout/de` um |
| `http://alfheim.loegien.localhost/library` | `library-frontend` | `3000` | Leitet nacktes `/library` zu `/library/en` um |
| `http://alfheim.loegien.localhost/maintenance`| `maintenance-frontend`| `3000`| Leitet nacktes `/maintenance` zu `/maintenance/en` um |
| `http://alfheim.loegien.localhost/shopping` | `shopping-frontend` | `3010` | Leitet nacktes `/shopping` zu `/shopping/en` um |
| `http://alfheim.loegien.localhost/chat` | `chat-frontend` | `3000` | Leitet nacktes `/chat` zu `/chat/de` um |
| `http://alfheim.loegien.localhost/grafana` | `grafana` | `3000` | Zitadel-SSO-Beobachtungs-Dashboard |

---

## API-Gateway-Domain-Routing (`api.alfheim.loegien.localhost`)

| Öffentlicher API-URL-Pfad | Ziel-Container | Container-Port | Pfad-Stripping-Regel |
| :--- | :--- | :--- | :--- |
| `http://auth.alfheim.loegien.localhost/` | `zitadel` | `8080` | Dedizierter IAM-Host. Zitadel unterstützt keine Sub-Path-Hosting; über h2c proxiert. |
| `http://api.alfheim.loegien.localhost/storage/` | `rustfs` | `9000` | Streift `/storage`-Präfix ab |
| `http://api.alfheim.loegien.localhost/pantry/api/v1/` | `pantry-backend` | `8000` | Streift `/pantry`-Präfix via `handle_path` ab |
| `http://api.alfheim.loegien.localhost/budget/api/v1/` | `budget-backend` | `8000` | Streift `/budget`-Präfix via `handle_path` ab |
| `http://api.alfheim.loegien.localhost/shopping/api/v1/`| `shopping-backend`| `8000` | Streift `/shopping`-Präfix via `handle_path` ab |
| `http://api.alfheim.loegien.localhost/maintenance/api/v1/`| `maintenance-backend`| `8000`| Streift `/maintenance`-Präfix via `handle_path` ab |
| `http://api.alfheim.loegien.localhost/workout/api/v1/`| `workout-backend` | `8000` | Streift `/workout`-Präfix via `handle_path` ab |
| `http://api.alfheim.loegien.localhost/library/api/v1/`| `library-backend` | `8000` | Streift `/library`-Präfix via `handle_path` ab |
| `http://api.alfheim.loegien.localhost/api/v1/chores` | `chores-backend` | `8000` | Native Route (kein Stripping) |
| `http://api.alfheim.loegien.localhost/api/v1/chat` | `chat-backend` | `8080` | Native Go-API-Route (kein Stripping) |
| `http://api.alfheim.loegien.localhost/api/v1/apps` | `dashboard-backend` | `8080` | Native Go-API-Route (kein Stripping) |

---

## Caddy-Pfad-Stripping-Regeln (`handle_path`)

Python-FastAPI-Microservices mounten REST-Router nativ unter `/api/v1`. Um Routing unter Service-Subpfaden zu ermöglichen (z.B. `api.alfheim.loegien.localhost/pantry/api/v1/items`), nutzt Caddy `handle_path`-Blöcke:

```caddy
@pantry_api path /pantry/*
handle_path /pantry/* {
    reverse_proxy pantry-backend:8000
}
```

Dies streift `/pantry` ab, bevor HTTP-Traffic an `pantry-backend:8000` weitergeleitet wird, damit das Backend `/api/v1/items` erhält.
