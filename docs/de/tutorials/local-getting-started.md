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

2. Lokale `.env`-Konfiguration erzeugen:
   ```bash
   ./scripts/setup-env.sh
   ```

3. Lokale Domain-Aliase in die Hosts-Datei eintragen (`/etc/hosts` unter Linux/macOS):
   ```hosts
   127.0.0.1 alfheim.loegien.localhost
   127.0.0.1 api.alfheim.loegien.localhost
   ```

---

## Schritt 2: Plattform-Stack starten (`up.sh`)

Der automatisierte, mehrstufige Boot-Orchestrator startet Infrastruktur, Control Plane und Microservices:

```bash
./scripts/up.sh -b -d
```

Das Skript startet den Cluster in abhängigkeitsgeordneten Stufen:
* **Stufe 0**: Gateway, Zitadel IAM, RustFS, VictoriaStack
* **Stufe 1**: Zentrale Dashboard-Control-Plane
* **Stufe 2**: Fachliche Microservices (Pantry, Budget, Chores usw.)

---

## Schritt 3: Dienste prüfen & Anwendungen öffnen

1. Health-Status der Container prüfen:
   ```bash
   docker compose ps
   ```

2. Im Browser das zentrale Dashboard öffnen:
   `http://alfheim.loegien.localhost/`

3. Microservices aufrufen:
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

## Nächste Schritte

* Einen neuen Microservice bauen: [Neuen FDD-Microservice erstellen](./create-new-fdd-service.md).
* Technische Spezifikationen nachschlagen im [Anwendungskatalog](../../en/reference/apps-catalog.md).
