---
title: "Backup, Restore & Data Migration"
description: "Backing up persistent Docker volumes, PostgreSQL dumps and RustFS S3 objects, and restoring them during server migration or disaster recovery."
---

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

Every service database lives in the single consolidated `alfheim_postgres_core` container
(compose service `postgres-core`), each in its own `alfheim_<app>` database with its own
`<app>_user` role — see [PostgreSQL Core Service](../../../infrastructure/postgres/README.md).
There is no per-app database container to target separately.

### 1. Single Service Database Dump (e.g. Pantry)
```bash
docker exec -t alfheim_postgres_core pg_dump -U postgres alfheim_pantry > pantry_backup_$(date +%Y%m%d).sql
```

### 2. IAM Database Dump (Zitadel)
```bash
docker exec -t alfheim_postgres_core pg_dump -U postgres zitadel > zitadel_backup_$(date +%Y%m%d).sql
```

### 3. Dump Every Alfheim Database in One Pass
```bash
for db in zitadel alfheim_dashboard alfheim_household alfheim_pantry alfheim_shopping \
          alfheim_maintenance alfheim_chores alfheim_budget alfheim_chat alfheim_workout \
          alfheim_library; do
  docker exec -t alfheim_postgres_core pg_dump -U postgres "$db" > "${db}_backup_$(date +%Y%m%d).sql"
done
```

---

## Backing Up Object Storage (RustFS S3)

RustFS stores uploaded attachments (e.g. budget receipts, library PDFs) in persistent storage volumes.

```bash
docker run --rm \
  -v alfheim-prod_rustfs_data:/data:ro \
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
cat pantry_backup.sql | docker exec -i alfheim_postgres_core psql -U postgres -d alfheim_pantry
```

### 2. Restore Persistent Volume Archive
```bash
# Stop containers
docker compose -f compose.prod.yaml down

# The volume name is prefixed with the Compose project name (compose.prod.yaml sets it to
# "alfheim-prod"), so the PostgreSQL data volume is alfheim-prod_postgres_core_data. Confirm with:
docker volume ls --format '{{.Name}}' | grep postgres_core_data

# Extract volume backup archive (postgres_core_data holds every service database)
docker run --rm \
  -v $(pwd):/backup \
  -v alfheim-prod_postgres_core_data:/target \
  alpine tar xzf /backup/alfheim_full_volumes_20260301.tar.gz -C /target --strip-components=2

# Restart stack
docker compose -f compose.prod.yaml up -d
```

---

## Automated Nightly Backup Cron Script

Add the following crontab entry (`crontab -e`) to execute automated daily backups at 03:00 AM:

```cron
0 3 * * * /bin/bash -c "cd ~/alfheim && docker exec -t alfheim_postgres_core pg_dump -U postgres alfheim_pantry > ~/backups/pantry_\$(date +\%Y\%m\%d).sql"
```
