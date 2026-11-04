---
title: "Plan the storage layout"
description: "Which Alfheim data lives where, how it grows, how to put it on separate disks, and which ZFS and Btrfs settings suit each class."
---

Use this guide before you give Alfheim its own disks, or when the system disk fills up. By default every data class lives in a Docker named volume under `/var/lib/docker/volumes`. You can move the four large classes to host directories with the `ALFHEIM_*_DATA_PATH` variables (see [Data Locations](../reference/environment-variables.md#data-locations)).

## Which data lives where

| Data | Default location | Variable to relocate | Growth |
| :--- | :--- | :--- | :--- |
| PostgreSQL: every app database, Zitadel | volume `postgres_core_data` | `ALFHEIM_DB_DATA_PATH` | Slow. Text and JSON (chat messages, audit payloads), a few hundred MB for a household for a long time. Chat history is the main driver. |
| RustFS objects: budget receipts, library manuals, chat images | volume `rustfs_data` | `ALFHEIM_OBJECT_DATA_PATH` | The largest and least predictable class: it grows with every upload. Receipts and chat images are stored as small WebP or JPEG files, manuals as the uploaded PDF (up to 50 MiB each by default). |
| Metrics (VictoriaMetrics) | volume `victoriametrics_data` | `ALFHEIM_METRICS_DATA_PATH` | Bounded: retention is 14 days. |
| Logs (VictoriaLogs) | volume `victorialogs_data` | `ALFHEIM_LOGS_DATA_PATH` | Bounded: retention is 7 days. |
| Caddy certificates and ACME state | volume `caddy_data`; custom certificates in `./data/caddy/certs/` | none | Kilobytes. Back it up, but it does not need its own disk. |
| Grafana state | volume `grafana_data` | none | Small. |

The sizes above are orders of magnitude, not measurements: watch `docker system df -v` after a few weeks and plan from your own numbers.

## Recommended layout

* **PostgreSQL on the fastest disk** (NVMe or SSD). Every request touches it and its write-ahead log is latency sensitive.
* **Objects on bulk storage** (a larger, slower disk or a NAS-backed mount). They are read rarely and written in whole files.
* **Metrics and logs** can stay on the system disk because their retention bounds them. Move them only if you extend the retention.
* Keep the **backup target off these disks** (see [Backup, Restore & Data Migration](./backup-restore.md)).

Set the paths when you install, for example:

```bash
sudo ./alfheim-setup \
  --db-data-path /mnt/nvme/alfheim/postgres \
  --object-data-path /mnt/bulk/alfheim/objects
```

`alfheim-setup` creates each directory with the owner its container needs (`70:70` for PostgreSQL, `10001:10001` for RustFS), checks that it is writable and warns if it is still on the same filesystem as `/`. Mount the disk first, otherwise the data ends up on the system disk under the mount point.

To move an existing installation, create a backup, stop the stack, set the variable (re-run `alfheim-setup --reconfigure` with the flag) and restore. Do not copy volume directories by hand. The steps are in [Backup, Restore & Data Migration](./backup-restore.md).

## Filesystem settings

Settings apply to the dataset or filesystem that holds the directory. Only tune what you can measure; these are starting points.

### ZFS

| Dataset | Settings | Why |
| :--- | :--- | :--- |
| PostgreSQL | `recordsize=16K`, `compression=lz4` | 16K is close to PostgreSQL's 8K page and avoids rewriting large records. Heap pages and write-ahead log compress well. |
| Objects | `compression=zstd` (or `lz4`), default `recordsize` | Whole files are written once. See the compression note below. |

```bash
zfs create -o recordsize=16K -o compression=lz4 -o atime=off tank/alfheim/postgres
zfs create -o compression=zstd -o atime=off tank/alfheim/objects
```

### Btrfs

Mount the filesystem holding the data with `compress=zstd:3`. Do **not** use `nodatacow` for PostgreSQL: it is often recommended for database files, but it disables data checksums and compression for the files, so silent corruption would go unnoticed. If copy-on-write fragmentation becomes a measured problem, plan a periodic `btrfs filesystem defragment` instead.

### Compression note

Filesystem compression gains little on the object store: receipts and chat images are already WebP or JPEG, and PDFs are already compressed. PostgreSQL heap and write-ahead log data compress well, which is also why the stack uses LZ4 for large column values (`default_toast_compression=lz4`). If CPU is tight, you can leave the object dataset uncompressed without losing much.

## Docker logs

Container logs are not part of the Alfheim data directories. Docker keeps them per container under `/var/lib/docker/containers/<id>/` (the `json-file` driver). `compose.prod.yaml` bounds every service to 3 files of 10 MB, and the compose guard in CI (`scripts/check-compose.py`) fails if a service lacks that limit or a memory limit. Worst case that is about 30 MB per container. If you want a different limit for the whole host, set it in `/etc/docker/daemon.json` (`log-opts`), which applies to containers created afterwards.

## See also

* [Backup, Restore & Data Migration](./backup-restore.md)
* [Self-Hosting & Installation Guide](./homelab-deployment.md)
* [Environment variables: Data Locations](../reference/environment-variables.md#data-locations)
* [alfheim-setup CLI reference](../reference/installer-cli.md)
