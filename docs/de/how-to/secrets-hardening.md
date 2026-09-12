---
title: "Secrets Hardening & Deployment-Reife"
description: "Betriebsleitfaden und Reifegrad-Audit für das Alfheim-Monorepo im Vorfeld des Release v0.1.0 Beta."
sidebar:
  label: "Secrets Hardening"
---

## 1. Zusammenfassung
Dieses Dokument ist Betriebsleitfaden und Reifegrad-Audit für das **Alfheim**-Homelab-Microservice-Monorepo mit Blick auf das Release `v0.1.0 Beta`. Alfheim besteht aus einer Go-Control-Plane, mehreren Python-FastAPI-Microservices (Pantry, Shopping, Maintenance, Chores, Workout, Library, Budget), einem Go-Chat-Dienst, React-/Next.js-Frontends, Zitadel IAM, RustFS S3, dem Caddy-Ingress-Gateway und einer VictoriaStack-Observability-Pipeline.

**Aktueller Stand:** 🟡 **Härtung erforderlich (Beta-Vorbereitung)**

Das Monorepo ist sauber nach Feature-Driven Design (FDD) modularisiert und breit getestet. Vor einer produktiven Ein-Befehl-Installation auf Bare-Metal-Home-Servern sind jedoch mehrere betriebliche und infrastrukturelle Punkte zu klären:
1. **Container-Sicherheit & Least Privilege:** Die Ausführung ohne Root-Rechte (`USER appuser`) ist in allen Backend-Diensten umgesetzt, produktive Compose-Overrides müssen den Security-Kontext aber strikt erzwingen.
2. **Umgebungsvariablen:** Fallback-Zugangsdaten aus den Entwicklungs-Compose-Dateien müssen im Beta-Deployment strikt durch `.env`-Secrets überschrieben werden.
3. **Observability & Health-Probes:** Healthcheck-Probes für Caddy, VictoriaStack und die Microservices müssen in `up.sh` und den Compose-Dateien vollständig aufeinander abgestimmt sein.

---

## 2. Erkannte Betriebs-Schulden & Behebung

### A. Sicherheit & Umgebungskonfiguration
- **Ort:** Microservice-`compose.yml`-Dateien (`core/dashboard/compose.yml`, `apps/*/compose.yml`)
  - **Stand:** Die Entwicklungs-Compose-Dateien liefern Fallback-Verbindungsparameter. Produktive Deployments müssen `DATABASE_URL`, `ZITADEL_MASTERKEY` und `S3_SECRET_KEY` explizit aus `.env`-Secrets beziehen.
  - **Maßnahme:** Sicherstellen, dass `scripts/setup-env.sh` für Produktivumgebungen kryptografisch sichere Secrets erzeugt.

- **Ort:** `infrastructure/telemetry/compose.yml`
  - **Stand:** Grafana-Admin-Zugangsdaten und Zitadel-OAuth-Secrets kommen aus Umgebungsvariablen.
  - **Maßnahme:** Strikte `.env`-Overrides erzwingen, bevor Telemetriedienste auf öffentlich erreichbaren Endpunkten laufen.

### B. Containerisierung & Netzwerk-Gateway
- **Ort:** `infrastructure/caddy/compose.yml` & `infrastructure/caddy/Caddyfile`
  - **Stand:** Caddy ist das zentrale Reverse-Proxy-Gateway und routet zu den Next.js-Frontends (`/`, `/pantry`, `/shopping` usw.) sowie zu den Backend-REST-APIs (`/api/v1/*`).
  - **Maßnahme:** Explizite Healthcheck-Probes für Caddy in `infrastructure/caddy/compose.yml` ergänzen, um Race Conditions beim Stack-Start zu vermeiden.

- **Ort:** `scripts/up.sh`
  - **Stand:** Der gestufte Boot-Orchestrator startet nacheinander Infrastruktur, Core-Dashboard und die fachlichen App-Slices.
  - **Maßnahme:** Die Wartebedingungen aller Stufen von Prozess-Prüfungen (`wait_running`) auf Health-Prüfungen (`wait_healthy`) umstellen.

---

## 3. Betriebs- & Lifecycle-Skripte

Für stabilen Produktivbetrieb auf Homelab-Knoten nutzt das Repository folgende standardisierte Skripte:

1. **Stack-Lifecycle:**
   - `./scripts/setup-env.sh`: Interaktive oder automatische Initialisierung der `.env`.
   - `./scripts/up.sh`: Gestufter Boot-Orchestrator mit Abhängigkeitsreihenfolge und Health-Warten.
   - `./scripts/down.sh`: Sauberes Herunterfahren aller Container und Netzwerke.
   - `./scripts/verify.sh`: Gebündelter Quality-Gate-Runner für Python, Go, Frontend und Security.
   - `./scripts/seed.sh`: Demo-Daten für frische Deployments.

---

## 4. Phasenplan zur Behebung

- [x] **Phase 1: Kritische Fixes & Secrets-Bereinigung**
  - [x] Unprivilegierte Nutzer (`USER appuser`) in allen Go- und Python-Backend-Dockerfiles.
  - [x] Alle fest verdrahteten DB-Zugangsdaten (`DATABASE_URL`), IAM-Secrets und S3-Schlüssel aus den Compose-Dateien in `.env`-Variablen mit starken Defaults auslagern.
  - [x] Standard-Admin-Zugangsdaten für RustFS und Grafana in `.env.example` härten.

- [ ] **Phase 2: Netzwerk, Auth & Infrastruktur**
  - [ ] `infrastructure/caddy/Caddyfile` um aktive Health-Checks (`lb_try_duration`, `fail_duration`) für die Microservice-Reverse-Proxys ergänzen.
  - [x] Dynamische Domain-Auflösung für eigene Homelab-LAN-Domains und IPs, jetzt über `ZITADEL_EXTERNALDOMAIN` und die TLS-Strategien des Installers abgedeckt (abgelöst durch ADR 0003 und ADR 0004).
  - [ ] Container-Netzwerkdefinitionen zwischen `compose.yaml` und den Subsystem-Compose-Dateien vereinheitlichen.

- [x] **Phase 1: Codebasis-Verifikation & Testsuiten**
  - [x] Workspace-weites Frontend-Typechecking (`tsc --noEmit`).
  - [x] Go-Race-Detector- und Coverage-Suiten (`go test -v -race -cover ./...`).
  - [x] Python-Pytest-Suiten und statische Typprüfung (`uv run ty check`, `pytest --cov`).

- [ ] **Phase 2: Healthcheck- & Start-Härtung**
  - [ ] Explizite Docker-`healthcheck`-Definitionen für Caddy-Gateway und VictoriaStack-Container.
  - [ ] `scripts/up.sh` Stufe 9 auf Container-Health warten lassen (`wait_healthy`).
  - [x] Retry-Logik für die IAM-Client-Registrierung, abgelöst durch den zweiphasigen Zitadel-Bootstrap in `tools/installer` (ADR 0004).

- [ ] **Phase 3: Coverage-Anhebung als CI/CD-Gate (90–95 %)**
  - [ ] Go-Backend-Paketabdeckung (`core/dashboard/backend` & `apps/chat/backend`) auf > 90 % heben.
  - [ ] Python-Pytest-Coverage-Schwelle von 75 % auf 95 % anheben.
  - [ ] Vitest-Coverage-Schwellen über alle Frontend-Pakete erzwingen.

- [ ] **Phase 4: Release-Automatisierung & Tagging (`v0.1.0 Beta`)**
  - [ ] GitHub-Actions-Workflows finalisieren (`.github/workflows/`).
  - [ ] Vollständige Clean-Boot-Verifikation durchführen (`./scripts/up.sh -b`).
  - [ ] Release `v0.1.0-beta` taggen.
