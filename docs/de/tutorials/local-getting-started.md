---
title: "Lokale Einrichtung"
description: "Einsteigerfreundliche Schritt-für-Schritt-Anleitung, um das gesamte Alfheim-Monorepo lokal auf dem Entwicklungsrechner zu starten."
sidebar:
  label: "Lokale Einrichtung"
---

> **Kurzfassung:** Einsteigerfreundliche Schritt-für-Schritt-Anleitung, um das gesamte Alfheim-Monorepo lokal auf dem Entwicklungsrechner zu starten.

---

## 📋 Inhalt
- [Voraussetzungen](#voraussetzungen)
- [Schritt 1: Repository klonen & Umgebung einrichten](#schritt-1-repository-klonen--umgebung-einrichten)
- [Schritt 2: Plattform-Stack starten (`up.sh`)](#schritt-2-plattform-stack-starten-upsh)
- [Schritt 3: Dienste prüfen & Anwendungen öffnen](#schritt-3-dienste-prüfen--anwendungen-öffnen)
- [Schritt 4: Testdaten einspielen (`seed.sh`)](#schritt-4-testdaten-einspielen-seedsh)
- [Stoppen & Aufräumen](#stoppen--aufräumen)
- [Nächste Schritte](#nächste-schritte)

---

## Voraussetzungen

Bevor du beginnst, muss dein Rechner folgende Anforderungen erfüllen:
* **Docker Engine** (>= 24.0) & **Docker Compose** v2 (>= 2.20)
* **Node.js** (>= 22.0) & **pnpm** (>= 9.0)
* **Python** (>= 3.12) & Paketmanager **uv**
* **Go** (>= 1.25)
* **cURL** & **Git**

---

## Schritt 1: Repository klonen & Umgebung einrichten

1. Repository klonen und in das Wurzelverzeichnis wechseln:
   ```bash
   git clone https://github.com/KroegerLeif/Alfheim.git alfheim
   cd alfheim
   ```

2. Lokale `.env` für die `*.localhost`-Entwicklungs-Hosts über reines HTTP erzeugen. Das Skript erstellt zufällige Dev-Secrets (Datenbank-Passwörter, `ALFHEIM_INTERNAL_TOKEN`, …); ein erneuter Aufruf behält vorhandene Werte und ergänzt nur fehlende Schlüssel:
   ```bash
   ./scripts/init-env.sh --auto --base-url http://alfheim.loegien.localhost
   ```

3. Optional: Chromium und Firefox lösen jeden `*.localhost`-Namen selbst nach `127.0.0.1` auf. Nur für andere Werkzeuge (zum Beispiel ein älteres `curl`) die Aliase in `/etc/hosts` eintragen:
   ```hosts
   127.0.0.1 alfheim.loegien.localhost
   127.0.0.1 api.alfheim.loegien.localhost
   127.0.0.1 auth.alfheim.loegien.localhost
   ```

---

## Schritt 2: Plattform-Stack starten (`up.sh`)

Der automatisierte, mehrstufige Boot-Orchestrator startet Infrastruktur, Control Plane und Microservices. Unter macOS ist das bei laufendem Docker Desktop ein einziger Befehl — ohne `sudo` und ohne für alle beschreibbare Verzeichnisse:

```bash
./scripts/up.sh -b
```

Mit `--skip-obs` bleibt der Observability-Stack aus. Das Skript startet den Cluster in abhängigkeitsgeordneten Stufen:
* **Stufe 0**: Vorabprüfung der Docker-Netzwerke
* **Stufe 1**: Postgres, Zitadel IAM, RustFS, Caddy-Gateway, danach die Provisionierung der Zitadel-OIDC-Clients
* **Stufe 2**: Kern-Apps: Dashboard, danach Household (`/household`; wird mit einer Warnung übersprungen, solange die Quellen in deinem Checkout fehlen)
* **Stufen 3–8**: Fachliche Microservices (Shopping, Pantry, Maintenance, Chores, Budget, Chat)
* **Stufe 9**: Observability (VictoriaMetrics, VictoriaLogs, OTel Collector, Vector, Grafana)

Zitadel schreibt sein Bootstrap-Token (PAT) in das Docker-Volume `zitadel_machinekey`. Ein einmaliger Container `zitadel-machinekey-init` übergibt dieses Volume vor dem Start von Zitadel an dessen Container-Benutzer (uid 1000), daher braucht auf deinem Host nichts ein `chown`. `up.sh` kopiert das PAT mit `docker compose cp` heraus und speichert es als `ZITADEL_BOOTSTRAP_PAT` in `.env`.

---

## Schritt 3: Dienste prüfen & Anwendungen öffnen

1. Health-Status der Container prüfen:
   ```bash
   docker compose ps
   ```

2. Im Browser das zentrale Dashboard öffnen:
   `http://alfheim.loegien.localhost/`

3. Microservices aufrufen:
   * **Household**: `http://alfheim.loegien.localhost/household/`
   * **Digitale Vorratskammer**: `http://alfheim.loegien.localhost/pantry`
   * **Budget & Finanzen**: `http://alfheim.loegien.localhost/budget`
   * **ALFI KI-Assistent**: `http://alfheim.loegien.localhost/chat`

---

## Schritt 4: Testdaten einspielen (`seed.sh`)

Befüllt die Datenbanken mit Test-Haushalten, Nutzern und Beispiel-Vorratsartikeln:

```bash
./scripts/seed.sh
```

---

## Stoppen & Aufräumen

Stack stoppen und alle Daten behalten:

```bash
./scripts/down.sh
```

Auf einen sauberen Ausgangszustand zurücksetzen (entfernt Container, Docker-Volumes einschließlich `zitadel_machinekey`, die externen Netzwerke und das Postgres-Datenverzeichnis). Vor einem frischen `up.sh` ausführen, wenn Zitadel sich neu initialisieren soll:

```bash
./scripts/down.sh --volumes
docker run --rm -v "$PWD/infrastructure/postgres:/pg" alpine:3.20 rm -rf /pg/data
```

Das Datenverzeichnis wird aus einem Wegwerf-Container gelöscht, weil es unter Linux dem Postgres-Container-Benutzer gehört; so braucht es auf keiner Plattform `sudo`. `down.sh --volumes` allein behält `infrastructure/postgres/data`. Zitadel bleibt dann initialisiert und schreibt kein neues PAT, daher greift `up.sh` auf `ZITADEL_BOOTSTRAP_PAT` in `.env` zurück.

---

## Nächste Schritte

* Einen neuen Microservice bauen: [Neuen FDD-Microservice erstellen](./create-new-fdd-service.md).
* Technische Spezifikationen nachschlagen im [Anwendungskatalog](../reference/apps-catalog.md).
