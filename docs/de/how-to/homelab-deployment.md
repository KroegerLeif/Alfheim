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
| **Speicher** | 10 GB SSD / NVMe | 20 GB+ SSD |
| **Netzwerk** | 100 Mbit/s Ethernet | 1 Gbit/s Gigabit-Ethernet |

**Speicher-Übersicht:** Eine frische Alfheim-Installation benötigt ~5,5–6,5 GB: Container-Images (≈3,6 GB entpackt), Basis-OS + Docker Engine (≈1,5–2,5 GB), frische Volumes (≈0,2 GB). Der verbleibende Platz ist für RustFS-Uploads (Budgetbelege, Bibliotheks-PDFs), nicht rotierte Container-Logs und Backups reserviert. Metriken-Aufbewahrung ist auf 14 Tage, Logs auf 7 Tage begrenzt (konfiguriert in `compose.prod.yaml`).

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

### Was der Installer automatisch erledigt
1. **`install.sh`** prüft auf `curl`, stellt einen Linux-Host mit `amd64` oder `arm64` fest, ermittelt das Release (standardmäßig das neueste *stabile*), lädt das passende `alfheim-setup`-Binary und die Stack-Dateien (`compose.prod.yaml`, Telemetrie- und PostgreSQL-Init-Dateien) ins **aktuelle Verzeichnis** und prüft jede Datei gegen die `SHA256SUMS` des Releases. Bei fehlender oder abweichender Prüfsumme bricht es ab.
2. **`alfheim-setup`** prüft den Host (Docker Engine und Compose v2) und erkennt den Modus: *install*, *update* (vorhandene `.env` oder `.alfheim.installed`) oder *reconfigure* (`--reconfigure`).
3. Domain, Administrator-E-Mail und TLS-Strategie fragt es im Assistenten ab oder liest sie mit `--non-interactive` aus Flags und Umgebungsvariablen.
4. Es erzeugt alle Zugangsdaten aus `crypto/rand` und schreibt `.env` (Modus `0600`) und `infrastructure/caddy/Caddyfile`. Werte, die schon in der `.env` stehen, werden übernommen, nie neu erzeugt.
5. Für die TLS-Strategie `internal` legt es einmalig eine lokale Root-CA an (`infrastructure/caddy/pki/root.{crt,key}`, öffentliche Kopie `infrastructure/ca/alfheim-root-ca.crt`) und gibt ihren SHA-256-Fingerprint aus.
6. **Phase 1, Edge & Identität:** startet `postgres-core`, `caddy` und `zitadel` und wartet, bis sie gesund sind.
7. **Phase 2, Zitadel-Provisionierung:** legt über die Management-API von Zitadel das Projekt `Alfheim`, den gemeinsamen Web-Client für Dashboard und alle Apps sowie den Grafana-Client an und schreibt deren IDs in die `.env`.
8. **Phase 3, Core- & Anwendungs-Stack:** lädt und startet alle übrigen Dienste, wartet auf das Dashboard und gibt die Zugangs-URLs, den Administrator-Login und bei `internal` die Schritte zum Vertrauen der Root-CA aus.

Jede Strategie liefert HTTPS aus. `hetzner` und `cloudflare` beziehen Let's-Encrypt-Wildcard-Zertifikate, `custom` nutzt deine PEM-Dateien, und `internal` signiert mit der lokalen Root-CA ([auf jedem Gerät vertrauen](./trust-local-root-ca.md)).

Für ein Pre-Release pinnst du einen Tag oder wählst den Pre-Release-Kanal:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | ALFHEIM_VERSION=v0.1.1-rc.12 bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | ALFHEIM_CHANNEL=prerelease bash
```

---

## 🛠️ Manuelle Installation

Nutze diesen Weg, wenn du jede Datei prüfen willst, bevor etwas läuft, oder kein Skript an `bash` weiterreichen kannst. Er wiederholt die Schritte von `install.sh` von Hand; Konfiguration und Start übernimmt weiterhin `alfheim-setup`.

### 1. Installationsverzeichnis anlegen
```bash
mkdir -p ~/alfheim && cd ~/alfheim
mkdir -p infrastructure/ca infrastructure/caddy/pki \
         infrastructure/telemetry/collector infrastructure/telemetry/vector infrastructure/postgres
```

Werden `infrastructure/ca` und `infrastructure/caddy/pki` vorab angelegt, erzeugt Docker diese Bind-Mount-Quellen nicht mit root als Besitzer.

### 2. Release-Dateien herunterladen und prüfen
```bash
TAG="v0.1.1-rc.12"          # zu installierendes Release
ARCH="amd64"                # oder arm64
BASE="https://github.com/KroegerLeif/Alfheim/releases/download/${TAG}"

curl -fsSLO "${BASE}/SHA256SUMS"
curl -fsSLO "${BASE}/alfheim-setup_linux_${ARCH}"
curl -fsSLO "${BASE}/compose.prod.yaml"
curl -fsSLO "${BASE}/otelcol-config.yaml"
curl -fsSLO "${BASE}/init-multiple-dbs.sh"
curl -fsSLO "${BASE}/vector.toml"

sha256sum --check --ignore-missing SHA256SUMS
```

Jede Datei muss `OK` melden. Dann die Dateien dorthin verschieben, wo `compose.prod.yaml` sie erwartet:

```bash
mv otelcol-config.yaml infrastructure/telemetry/collector/config.yaml
mv vector.toml infrastructure/telemetry/vector/vector.toml
mv init-multiple-dbs.sh infrastructure/postgres/init-multiple-dbs.sh
chmod +x infrastructure/postgres/init-multiple-dbs.sh "alfheim-setup_linux_${ARCH}"
```

### 3. Konfiguration vorab ansehen (optional)
```bash
./alfheim-setup_linux_${ARCH} --dry-run --non-interactive --domain example.com --tls internal
```

Ein Dry Run rendert `.env` und Caddyfile, ohne einen Container zu starten.

### 4. Installer ausführen
Interaktiv:

```bash
./alfheim-setup_linux_${ARCH}
```

Oder ohne Assistent, zum Beispiel mit Hetzner DNS-01:

```bash
ALFHEIM_DNS_API_TOKEN="<token>" ./alfheim-setup_linux_${ARCH} \
  --non-interactive --domain example.com --tls hetzner --admin-email du@example.com
```

Der Installer durchläuft dieselben drei Phasen wie oben und startet den gesamten Stack. Alle Flags und Umgebungsvariablen stehen in der [Installer-CLI-Referenz](../reference/installer-cli.md).

### 5. Ergebnis prüfen
```bash
docker compose -f compose.prod.yaml ps
```

Jeder Dienst meldet `running`, Dienste mit Healthcheck melden `healthy`. Die erzeugte `.env` enthält Konfiguration und Zugangsdaten; Domain oder TLS änderst du mit `alfheim-setup --reconfigure` statt von Hand, damit Caddyfile und Zitadel-Clients zueinander passen.

---

## 🌐 Einrichtung nach der Installation & Zugriff

Sobald die Container `healthy` melden:

1. **Zentrales Alfheim-Dashboard**:
   * Im Browser `https://<deine-domain>` aufrufen (der Wert von `ALFHEIM_BASE_URL`).
   * Nutze `https://`. Die Anmeldung braucht einen sicheren Kontext, deshalb zeigt das Dashboard über reines `http://` auf jedem Host außer `localhost` *Secure connection (HTTPS) required* statt des Logins.
   * Mit der Installer-Strategie `internal` vertraust du zuerst der erzeugten Root-CA oder akzeptierst die Zertifikatswarnung für App-Host und Auth-Host. Siehe [Der lokalen Root-CA vertrauen](./trust-local-root-ca.md).
   * Das Wurzel-Dashboard bündelt alle registrierten Haushaltsmodule (Pantry, Shopping, Chores, Maintenance, Chat, Budget, Workout, Library).

2. **Zitadel-IAM-Administration**:
   * URL: `https://<deine-auth-domain>/ui/console` (gesetzt über `ZITADEL_EXTERNALDOMAIN`)
   * Benutzername: siehe `ZITADEL_ADMIN_USER` in der `.env`.
   * Passwort: siehe `ZITADEL_ADMIN_PASSWORD` in der `.env`.

3. **Grafana-Observability-Stack**:
   * URL: `https://<deine-domain>/grafana/`
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
