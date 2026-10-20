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
- [Vom Installer erzeugter App-Host: Household- & interne Routen](#vom-installer-erzeugter-app-host-household---interne-routen)

---

## Gateway-Übersicht & Domains

Traffic in Alfheim durchläuft einen zentralen Caddy-Ingress-Proxy (`infrastructure/caddy`).

* **Frontend-Domain**: `alfheim.loegien.de` / `alfheim.loegien.localhost`
* **API-Gateway-Domain**: `api.alfheim.loegien.de` / `api.alfheim.loegien.localhost`

Die Tabellen unten beschreiben den Entwicklungs-Stack (`scripts/up.sh`), der die `*.localhost`-Hosts über reines HTTP ausliefert. Chromium und Firefox behandeln `localhost`-Namen als sicheren Kontext, daher funktioniert die Anmeldung dort. Vom Installer erzeugte Deployments liefern jeden Host über HTTPS mit der bei der Installation gewählten Zertifikatsstrategie aus:

| TLS-Strategie | Zertifikate | Browser-Vertrauen |
| :--- | :--- | :--- |
| `hetzner`, `cloudflare`, `desec` | Let's-Encrypt-Wildcard via DNS-01 | Vertraut |
| `custom` | Eigene PEM-Dateien | Hängt von der ausstellenden CA ab |
| `internal` (auch das LAN-Preset `.localhost`) | Signiert von der Root-CA des Installers (Caddy-CA-ID `alfheim`, Root schreibgeschützt eingebunden aus `infrastructure/caddy/pki/`) | Warnt, bis [der lokalen Root-CA vertraut wird](../how-to/trust-local-root-ca.md) |

---

## Frontend-Domain-Routing (`alfheim.loegien.localhost`)

| Öffentlicher URL-Pfad | Ziel-Container | Container-Port | Anmerkungen |
| :--- | :--- | :--- | :--- |
| `http://alfheim.loegien.localhost/` | `dashboard-frontend` | `3000` | Dashboard-Landesseite der Plattform |
| `http://alfheim.loegien.localhost/pantry` | `pantry-frontend` | `3000` | Nacktes `/pantry` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/budget` | `budget-frontend` | `3000` | Nacktes `/budget` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/chores` | `chores-frontend` | `3000` | Nacktes `/chores` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/workout` | `workout-frontend` | `3000` | Nacktes `/workout` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/library` | `library-frontend` | `3000` | Nacktes `/library` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/maintenance`| `maintenance-frontend`| `3000`| Nacktes `/maintenance` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/shopping` | `shopping-frontend` | `3010` | Nacktes `/shopping` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/chat` | `chat-frontend` | `3000` | Nacktes `/chat` leitet die App selbst auf die Sprache um (next-intl) |
| `http://alfheim.loegien.localhost/grafana` | `grafana` | `3000` | Zitadel-SSO-Beobachtungs-Dashboard |
| `http://alfheim.loegien.localhost/household` | `household-frontend` | `3000` | basePath `/household`, kein Sprachpräfix |
| `http://alfheim.loegien.localhost/api/v1/households`, `/api/v1/profile` | `household-backend` | `8080` | Pfad bleibt erhalten; hat Vorrang vor dem Dashboard-Catch-all `/api/v1/*` |
| `http://alfheim.loegien.localhost/internal/` | — | — | `404`: Service-zu-Service-Endpunkte werden nie geroutet (ebenso auf `api.*`) |

Das Gateway routet nur: Es setzt keine Sprach-Weiterleitungen. Jede Next.js-App führt die next-intl-Middleware aus, die ein nacktes `/<app>` auf die Sprache aus dem `NEXT_LOCALE`-Cookie, danach `Accept-Language`, danach den App-Standard (`de` bei Chores und Workout, sonst `en`) umleitet.

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
| `http://api.alfheim.loegien.localhost/api/v1/households`, `/api/v1/profile` | `household-backend` | `8080` | Native Go-API-Route (kein Stripping); hat Vorrang vor dem Dashboard-Catch-all |
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

---

## Vom Installer erzeugter App-Host: Household- & interne Routen

Die Caddyfile, die `alfheim-setup` rendert (`tools/installer/internal/features/templating/embedded/Caddyfile.tmpl`), stellt jede API direkt auf dem App-Host bereit, damit Browser relative `/api/v1/...`-Pfade aufrufen. Der Tier-1-Haushalts- & Rollendienst ergänzt diese Regeln:

| Öffentlicher URL-Pfad | Ziel-Container | Container-Port | Regel |
| :--- | :--- | :--- | :--- |
| `https://alfheim.loegien.de/api/v1/households*` | `household-backend` | `8080` | `handle`, Pfad bleibt erhalten (kein Rewrite) |
| `https://alfheim.loegien.de/api/v1/profile*` | `household-backend` | `8080` | `handle`, Pfad bleibt erhalten (kein Rewrite) |
| `https://alfheim.loegien.de/household*` | `household-frontend` | `3000` | Next.js-basePath `/household` |
| `https://alfheim.loegien.de/internal/*` | _(keiner)_ | — | `respond 404`: die Service-zu-Service-API wird nie geroutet |
| `https://auth.loegien.de/internal/*` | _(keiner)_ | — | `respond 404`, zusätzliche Absicherung auf dem IAM-Host |

Caddy fasst alle `handle`- und `handle_path`-Blöcke einer Site in eine sich gegenseitig ausschließende Gruppe zusammen und sortiert sie nach Pfadlänge, die längste zuerst. `/api/v1/households*` und `/api/v1/profile*` sind länger als die allgemeine Dashboard-Route `/api/v1*` und gewinnen daher immer. Kein App-Slug ist ein Präfix von `households` oder `profile`, also kann auch keine `/api/v1/<slug>*`-Regel sie treffen. Alle Pfade, die keine andere Regel trifft, bedient weiterhin das Dashboard-Frontend.

---

## Sicherheits-Header der Antworten

Jeder Site-Block (App-Host, `auth.*`-Host und im Dev-Stack der `api.*`-Host) importiert ein gemeinsames `security_headers`-Snippet. Jedes Feld nutzt das `?`-Präfix von Caddy: Ein Header, den der Upstream bereits sendet (Zitadel, Grafana), bleibt erhalten, nur fehlende werden ergänzt.

| Header | Wert | Zweck |
| :--- | :--- | :--- |
| `X-Content-Type-Options` | `nosniff` | Schaltet MIME-Sniffing ab |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Kein Pfad und keine Query an fremde Origins |
| `X-Frame-Options`, `Content-Security-Policy` | `SAMEORIGIN`, `frame-ancestors 'self'` | Clickjacking-Schutz; der PDF-Viewer der Bibliothek bettet eine gleich-originäre `/storage`-URL ein |
| `Permissions-Policy` | Kamera, Mikrofon, Standort, Zahlung, USB deaktiviert | Keine Alfheim-App braucht sie |
| `Content-Security-Policy-Report-Only` | Same-Origin-Basis plus `auth.*`-Host in `connect-src` | Nur Report-Only: Next.js erzeugt Inline-Bootstrap-Skripte, ein erzwungenes `script-src` braucht zuerst Nonces. Verstöße erscheinen in der Browser-Konsole. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Nur bei installer-generierten HTTPS-Deployments; der Dev-Stack läuft über reines HTTP |
| `Server` | entfernt | Verbirgt das Proxy-Banner |

Der Dev-Host `api.*` setzt keine CORS-Header. Jedes Frontend ruft die API über seine eigene Origin auf (`NEXT_PUBLIC_API_URL` wird aus `ALFHEIM_BASE_URL` abgeleitet), Browser stellen dort also keine Cross-Origin-Anfragen. `./scripts/verify-stack.sh` prüft diese Header auf einem laufenden Stack.

## Routentabelle des Installers

Installer-Template und Dev-Caddyfile routen identisch. `/api/v1/<slug>*` wird bei Pantry, Maintenance, Budget und Workout auf `/api/v1/...` gekürzt und bei Shopping, Chores, Library und Chat unverändert durchgereicht, weil deren Backends diesen Pfad selbst bedienen. `/<slug>/api/v1*` funktioniert immer ebenfalls: Es wird auf `/api/v1` umgeschrieben, bei Chores, Library und Chat auf `/api/v1/<slug>`. Jeden anderen `/api/v1/*`-Pfad erhält das Dashboard-Backend unverändert. Das Shopping-Frontend lauscht auf Port `3010`, alle anderen Frontends auf `3000`.
