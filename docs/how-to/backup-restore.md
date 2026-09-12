# How-To: Backup, Restore & Data Migration

> **TL;DR:** Procedures for backing up persistent Docker volumes, PostgreSQL database dumps, RustFS S3 object storage blobs, and restoring them during server migration or disaster recovery.

---

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Backing Up Relational Databases (PostgreSQL)](#backing-up-relational-databases-postgresql)
- [Backing Up Object Storage (RustFS S3)](#backing-up-object-storage-rustfs-s3)
- [Backing Up All Persistent Docker Volumes](#backing-up-all-persistent-docker-volumes)
- [Restoring Data from Backup](#restoring-data-from-backup)
- [Automated Nightly Backup Cron Script](#automated-nightly-backup-cron-script)

---

## Prerequisites

- Active SSH access to your home server host.
- Sufficient free disk space for backup archives (`/backup` or external drive).
- `tar`, `gzip`, and Docker CLI installed.

---

## Backing Up Relational Databases (PostgreSQL)

Alfheim uses a "Database per Service" architecture. You can dump individual service databases or export all databases in one command.

### 1. Single Service Database Dump (e.g. Pantry)
```bash
docker exec -t alfheim_pantry_db pg_dump -U postgres pantry > pantry_backup_$(date +%Y%m%d).sql
```

### 2. IAM Database Dump (Zitadel)
```bash
docker exec -t alfheim_postgres_core pg_dump -U postgres zitadel > zitadel_backup_$(date +%Y%m%d).sql
```

---

## Backing Up Object Storage (RustFS S3)

RustFS stores uploaded attachments (e.g. budget receipts, chat file attachments) in persistent storage volumes.

```bash
docker run --rm \
  -v alfheim_rustfs_data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/rustfs_backup_$(date +%Y%m%d).tar.gz /data
```

---

## Backing Up All Persistent Docker Volumes

To create a full system snapshot of all Alfheim Docker volumes:

```bash
# Stop containers gracefully to ensure database consistency
docker compose -f compose.prod.yaml stop

# Archive all alfheim volumes into a compressed tarball
docker run --rm \
  $(docker volume ls -q | grep alfheim | sed 's/^/-v /;s/$/:\/volumes\/&/') \
  -v $(pwd):/backup \
  alpine tar czf /backup/alfheim_full_volumes_$(date +%Y%m%d).tar.gz /volumes

# Restart stack
docker compose -f compose.prod.yaml start
```

---

## Restoring Data from Backup

### 1. Restore PostgreSQL Database
```bash
cat pantry_backup.sql | docker exec -i alfheim_pantry_db psql -U postgres -d pantry
```

### 2. Restore Persistent Volume Archive
```bash
# Stop containers
docker compose -f compose.prod.yaml down

# Extract volume backup archive
docker run --rm \
  -v $(pwd):/backup \
  -v alfheim_pantry_db_data:/target \
  alpine tar xzf /backup/alfheim_full_volumes_20260301.tar.gz -C /target --strip-components=2

# Restart stack
docker compose -f compose.prod.yaml up -d
```

---

## Automated Nightly Backup Cron Script

Add the following crontab entry (`crontab -e`) to execute automated daily backups at 03:00 AM:

```cron
0 3 * * * /bin/bash -c "cd ~/alfheim && docker exec -t alfheim_pantry_db pg_dump -U postgres pantry > ~/backups/pantry_\$(date +\%Y\%m\%d).sql"
```
