---
title: "Self-Hosting & Installation"
description: "Alfheim produktiv auf einem Home-Server oder im Homelab bereitstellen, konfigurieren und warten — per automatischem Installer oder manueller Anleitung."
sidebar:
  label: "Homelab-Deployment"
---

Willkommen zur Installationsanleitung für **Alfheim Home Server OS**. Dieses Dokument enthält alles, was du brauchst, um Alfheim produktiv auf deinem Home-Server oder im Homelab bereitzustellen, zu konfigurieren und zu warten.

---

## 📋 Systemanforderungen & Voraussetzungen

### Hardware

| Komponente | Minimum | Empfohlen (alle Dienste aktiv) |
| :--- | :--- | :--- |
| **CPU** | 2 Kerne (x86_64 oder arm64) | 4+ Kerne (x86_64 oder arm64) |
| **RAM** | 4 GB (mit 2 GB Swap) | 8 GB+ |
| **Speicher** | 20 GB SSD / NVMe | 50 GB+ SSD |
| **Netzwerk** | 100 Mbit/s Ethernet | 1 Gbit/s Gigabit-Ethernet |

### Unterstützte Betriebssysteme
* **Linux (empfohlen)**: Debian 12 (Bookworm), Ubuntu 22.04 / 24.04 LTS, Fedora Server, Rocky Linux / AlmaLinux 9.
* **Virtualisierung**: Proxmox VE (Debian-VM oder LXC-Container mit `nesting=1` und `keyctl=1`).
* **Einplatinenrechner**: Raspberry Pi 4 / 5 (Debian 64-Bit / Raspberry Pi OS 64-Bit).
* **Entwicklung / macOS**: macOS 14+ mit Docker Desktop oder OrbStack.

### Software-Voraussetzungen
1. **Docker Engine**: Version `24.0.0` oder neuer.
   * [Offizielle Installationsanleitung](https://docs.docker.com/engine/install/)
2. **Docker Compose**: Version `v2.20.0` oder neuer (Compose-v2-Plugin).
   * Prüfen mit: `docker compose version`
3. **cURL**: Standard-POSIX-`curl`.

---

## 🚀 Schnellstart: Installation mit einem Befehl

Der schnellste Weg zur Installation auf einem Home-Server ist der automatische Installer:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

### Was der Installer automatisch erledigt:
1. Prüft Docker Engine, Docker Compose v2 und die Systemvoraussetzungen.
2. Legt das Anwendungsverzeichnis unter `~/alfheim` an.
3. Lädt die offiziellen Release-Orchestrierungsdateien (`compose.prod.yaml`, `Caddyfile`, Telemetrie-Konfigurationen).
4. Erzeugt kryptografisch starke Zufalls-Zugangsdaten (AES-256-Chat-Verschlüsselungsschlüssel, PostgreSQL-Passwörter, Zitadel-Masterkey und Admin-Passwort, S3-Zugangsdaten) und speichert sie mit `chmod 600` in der `.env`.
5. Gibt die nächsten Schritte zum Starten des Stacks aus.

---

## 🛠️ Manuelle Installation

Wenn du die volle Kontrolle über die Serverkonfiguration möchtest, folge dieser Schritt-für-Schritt-Anleitung:

### 1. Verzeichnisstruktur anlegen
```bash
mkdir -p ~/alfheim/infrastructure/telemetry/collector
cd ~/alfheim
```

### 2. Release-Dateien herunterladen
Lade die Dateien direkt vom letzten getaggten Release:

```bash
RELEASE_TAG="v0.1.0-beta.1"
BASE_URL="https://raw.githubusercontent.com/KroegerLeif/Alfheim/${RELEASE_TAG}"

curl -sSL "${BASE_URL}/compose.prod.yaml" -o compose.prod.yaml
curl -sSL "${BASE_URL}/.env.example" -o .env.example
curl -sSL "${BASE_URL}/scripts/init-env.sh" -o init-env.sh
curl -sSL "${BASE_URL}/infrastructure/caddy/Caddyfile" -o Caddyfile
curl -sSL "${BASE_URL}/infrastructure/telemetry/collector/config.yaml" -o infrastructure/telemetry/collector/config.yaml

chmod +x init-env.sh
```

### 3. Umgebung & Secrets erzeugen
Den kryptografischen Secret-Generator ausführen:

```bash
# Nicht-interaktiv (Standard: https://alfheim.loegien.de)
./init-env.sh --auto

# Oder mit eigener Basis-URL / Domain und Registry-Overrides:
./init-env.sh --base-url https://home.myhomelab.net --registry ghcr.io --repo myuser/alfheim --tag v0.1.0-beta.1
```

### 4. Konfiguration prüfen (`.env`)
Die erzeugte `.env` durchsehen und bei Bedarf anpassen:
```bash
nano .env
```

Wichtige Optionen:
* `ALFHEIM_BASE_URL`: Wurzel-URL deines Servers (z. B. `https://alfheim.loegien.de` oder `http://192.168.1.100`), aus der alle Frontend- und API-Routen abgeleitet werden.
* `IMAGE_REGISTRY`: Container-Registry für vorgebaute Images (aus dem Git-Remote abgeleitet; Standard: `ghcr.io`).
* `IMAGE_REPO`: Namespace des Container-Repositories (aus dem Git-Remote abgeleitet; Standard: `kroegerleif/alfheim`).
* `IMAGE_TAG`: Ziel-Versions-Tag (Standard: `latest`).
* `ZITADEL_EXTERNALDOMAIN`: Öffentlicher Host der Zitadel-Konsole und des OIDC-Issuers (z. B. `auth.loegien.de`).
* `OIDC_ISSUER_URL`: Kanonischer OIDC-Issuer für die JWT-Verifikation (der blanke Origin des IAM-Hosts).
* `CHAT_ENCRYPTION_KEY`: Automatisch erzeugter 32-Byte-Base64-Schlüssel, der LLM-API-Schlüssel im Ruhezustand mit AES-256-GCM schützt.

### 5. Stack starten
Alle Dienste im Hintergrund starten:

```bash
docker compose -f compose.prod.yaml up -d
```

Start und Healthchecks beobachten:
```bash
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs -f
```

---

## 🌐 Einrichtung nach der Installation & Zugriff

Sobald die Container `healthy` melden:

1. **Zentrales Alfheim-Dashboard**:
   * Im Browser aufrufen: `http://<server-ip>` oder `http://localhost`
   * Das Wurzel-Dashboard bündelt alle registrierten Haushaltsmodule (Pantry, Shopping, Chores, Maintenance, Chat, Budget, Workout, Library).

2. **Zitadel-IAM-Administration**:
   * URL: `https://<deine-auth-domain>/ui/console` (gesetzt über `ZITADEL_EXTERNALDOMAIN`)
   * Benutzername: siehe `ZITADEL_ADMIN_USER` in der `.env`.
   * Passwort: siehe `ZITADEL_ADMIN_PASSWORD` in der `.env`.

3. **Grafana-Observability-Stack**:
   * URL: `http://<server-ip>/grafana/`
   * Benutzername: `admin`
   * Passwort: siehe `GRAFANA_ADMIN_PASSWORD` in der `.env`.

---

## 🔄 Updates & Wartung

### Aktualisierte Container-Images holen
Wenn eine neue Version erscheint:

```bash
cd ~/alfheim

# Neueste vorgebaute Images holen
docker compose -f compose.prod.yaml pull

# Container ohne Ausfallzeit neu erzeugen
docker compose -f compose.prod.yaml up -d
```

### Persistente Daten sichern
Alle Datenbanken, Objektspeicher-Blobs und Telemetriedaten liegen in benannten Docker-Volumes:

```bash
# Alle Alfheim-Volumes auflisten
docker volume ls | grep alfheim

# Vollständiges Backup-Archiv der Volume-Daten erzeugen
docker run --rm \
  -v alfheim-prod_postgres_core_data:/data/postgres \
  -v alfheim-prod_rustfs_data:/data/rustfs \
  -v alfheim-prod_victoriametrics_data:/data/metrics \
  -v alfheim-prod_victorialogs_data:/data/logs \
  -v $(pwd):/backup \
  alpine tar czf /backup/alfheim-backup-$(date +%Y%m%d).tar.gz /data
```

### Plattform stoppen oder zurücksetzen
```bash
# Sauber stoppen
docker compose -f compose.prod.yaml stop

# Vollständig abbauen (alle Daten-Volumes bleiben erhalten)
docker compose -f compose.prod.yaml down

# Abbauen UND alle persistenten Daten löschen (VORSICHT: unwiderruflich!)
docker compose -f compose.prod.yaml down -v
```
