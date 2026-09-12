---
title: "Backup, Wiederherstellung & Datenmigration"
description: "Persistente Docker-Volumes, PostgreSQL-Dumps und RustFS-S3-Objekte sichern und bei Servermigration oder im Katastrophenfall wiederherstellen."
---

> **Kurzfassung:** Verfahren zum Sichern persistenter Docker-Volumes, PostgreSQL-Datenbank-Dumps und RustFS-S3-Objekte sowie zur Wiederherstellung bei Servermigration oder im Katastrophenfall.

---

## 📋 Inhalt
- [Voraussetzungen](#voraussetzungen)
- [Relationale Datenbanken sichern (PostgreSQL)](#relationale-datenbanken-sichern-postgresql)
- [Objektspeicher sichern (RustFS S3)](#objektspeicher-sichern-rustfs-s3)
- [Alle persistenten Docker-Volumes sichern](#alle-persistenten-docker-volumes-sichern)
- [Daten aus dem Backup wiederherstellen](#daten-aus-dem-backup-wiederherstellen)
- [Automatisches nächtliches Backup per Cron](#automatisches-nächtliches-backup-per-cron)

---

## Voraussetzungen

- Aktiver SSH-Zugang zum Home-Server.
- Ausreichend freier Speicher für die Backup-Archive (`/backup` oder eine externe Platte).
- `tar`, `gzip` und die Docker-CLI installiert.

---

## Relationale Datenbanken sichern (PostgreSQL)

Alfheim nutzt eine „Database per Service"-Architektur. Du kannst einzelne Dienst-Datenbanken dumpen oder alle auf einmal exportieren.

### 1. Einzelne Dienst-Datenbank dumpen (Beispiel Pantry)
```bash
docker exec -t alfheim_pantry_db pg_dump -U postgres pantry > pantry_backup_$(date +%Y%m%d).sql
```

### 2. IAM-Datenbank dumpen (Zitadel)
```bash
docker exec -t alfheim_postgres_core pg_dump -U postgres zitadel > zitadel_backup_$(date +%Y%m%d).sql
```

---

## Objektspeicher sichern (RustFS S3)

RustFS legt hochgeladene Anhänge (z. B. Budget-Belege, Chat-Dateianhänge) in persistenten Volumes ab.

```bash
docker run --rm \
  -v alfheim_rustfs_data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/rustfs_backup_$(date +%Y%m%d).tar.gz /data
```

---

## Alle persistenten Docker-Volumes sichern

Für einen vollständigen Systemschnappschuss aller Alfheim-Volumes:

```bash
# Container sauber stoppen, damit die Datenbanken konsistent sind
docker compose -f compose.prod.yaml stop

# Alle alfheim-Volumes in ein komprimiertes Tarball archivieren
docker run --rm \
  $(docker volume ls -q | grep alfheim | sed 's/^/-v /;s/$/:\/volumes\/&/') \
  -v $(pwd):/backup \
  alpine tar czf /backup/alfheim_full_volumes_$(date +%Y%m%d).tar.gz /volumes

# Stack wieder starten
docker compose -f compose.prod.yaml start
```

---

## Daten aus dem Backup wiederherstellen

### 1. PostgreSQL-Datenbank wiederherstellen
```bash
cat pantry_backup.sql | docker exec -i alfheim_pantry_db psql -U postgres -d pantry
```

### 2. Volume-Archiv wiederherstellen
```bash
# Container stoppen
docker compose -f compose.prod.yaml down

# Volume-Backup entpacken
docker run --rm \
  -v $(pwd):/backup \
  -v alfheim_pantry_db_data:/target \
  alpine tar xzf /backup/alfheim_full_volumes_20260301.tar.gz -C /target --strip-components=2

# Stack wieder starten
docker compose -f compose.prod.yaml up -d
```

---

## Automatisches nächtliches Backup per Cron

Folgenden Crontab-Eintrag ergänzen (`crontab -e`), um täglich um 03:00 Uhr zu sichern:

```cron
0 3 * * * /bin/bash -c "cd ~/alfheim && docker exec -t alfheim_pantry_db pg_dump -U postgres pantry > ~/backups/pantry_\$(date +\%Y\%m\%d).sql"
```
