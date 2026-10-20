---
title: "Backup, Restore & Data Migration"
description: "Back up and restore an Alfheim installation with alfheim-setup: databases, object storage and the secrets needed to read them, including a nightly schedule, off-site copies and a restore drill."
---

> **TL;DR:** `alfheim-setup backup` writes one archive with every database, the RustFS object storage and the secrets that make them readable. `alfheim-setup restore <archive>` rebuilds an installation from it, ideally on a fresh host. `alfheim-setup update` takes a database and secrets backup automatically before it changes anything.

---

## 📋 Table of Contents
- [What a backup contains](#what-a-backup-contains)
- [Create a backup](#create-a-backup)
- [Schedule nightly backups](#schedule-nightly-backups)
- [Keep copies off the host](#keep-copies-off-the-host)
- [Restore from a backup](#restore-from-a-backup)
- [Restore drill](#restore-drill)
- [Backup before every update](#backup-before-every-update)
- [Troubleshooting](#troubleshooting)

---

## What a backup contains

One timestamped `alfheim-backup-<UTC>.tar.gz` (mode `0600`):

| Entry | Why it is needed |
| :--- | :--- |
| `database.sql` | `pg_dumpall` of the whole `postgres-core` cluster: every `alfheim_<app>` database, the Zitadel database (users, projects, OIDC clients) and all roles. |
| `rustfs-data.tar` | The RustFS volume with uploaded files (budget receipts, library PDFs). Left out by `--skip-media` and by the pre-update backup. |
| `files/.env` | Every secret. Without `ZITADEL_MASTERKEY` the Zitadel database cannot be read; without the application keys, encrypted values such as stored chat API keys are lost. |
| `files/infrastructure/zitadel/machinekey/` | The Zitadel bootstrap token. |
| `files/infrastructure/ca/`, `files/infrastructure/caddy/pki/` | The generated root CA (`--tls internal`). Without it every device has to trust a new CA. |
| `files/` stack files | `compose.prod.yaml`, Caddyfile, telemetry and Postgres init configuration, `.alfheim.installed`. |
| `manifest.json` | Release (`IMAGE_TAG`), PostgreSQL version, installer version and a SHA-256 checksum for every entry. |

> **The archive holds every secret in plaintext.** Treat it like the `.env`:
> keep it private and encrypt it before it leaves the host.

Metrics and logs (VictoriaMetrics, VictoriaLogs, Grafana) are not backed up; they are rebuilt from the running system.

---

## Create a backup

The stack must be running, because the dump is taken through the `postgres-core` container. From the installation directory:

```bash
alfheim-setup backup
```

| Flag | Default | Meaning |
| :--- | :--- | :--- |
| `--output DIR` (`ALFHEIM_BACKUP_DIR`) | `<install-dir>/backups` | Where archives go. Created with mode `0700`. |
| `--keep N` | `7` | Keep the `N` newest archives, delete older ones. Only files named `alfheim-backup-<timestamp>.tar.gz` are ever deleted. |
| `--skip-media` | off | Leave the RustFS object storage out (a much smaller, faster archive). |
| `--install-dir DIR` (`ALFHEIM_INSTALL_DIR`) | current directory | Installation root. |

The command exits non-zero, and leaves no partial archive, if the dump is incomplete or any step fails.

Notes:

- The dump runs without a TTY and uses `POSTGRES_USER` from `.env`, so a non-default database user works.
- The RustFS volume is read while the stack keeps running, through a short-lived `alpine` container. For an exactly consistent snapshot of uploads and database, run the backup during a quiet period.
- The first media backup pulls the `alpine:3.24` image.

---

## Schedule nightly backups

### systemd timer (recommended)

`/etc/systemd/system/alfheim-backup.service`:

```ini
[Unit]
Description=Alfheim nightly backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/srv/alfheim
ExecStart=/usr/local/bin/alfheim-setup backup --keep 14
# Optional off-site copy, see the next section:
# ExecStartPost=/usr/local/bin/alfheim-offsite-sync
```

`/etc/systemd/system/alfheim-backup.timer`:

```ini
[Unit]
Description=Run the Alfheim backup nightly

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now alfheim-backup.timer
systemctl list-timers alfheim-backup.timer
```

### cron

```cron
0 3 * * * cd /srv/alfheim && /usr/local/bin/alfheim-setup backup --keep 14 >> /var/log/alfheim-backup.log 2>&1
```

Check `journalctl -u alfheim-backup.service` (or the log file) now and then: a backup nobody reads the result of can fail silently for months.

---

## Keep copies off the host

A backup on the same disk does not survive a failed disk, a stolen server or ransomware. Follow the 3-2-1 rule: three copies, two media, one off-site.

1. **Encrypt before upload**, because the archive contains secrets:
   ```bash
   age -r age1yourpublickey... -o "$f.age" "$f"      # or: gpg --encrypt --recipient you@example.com "$f"
   ```
2. **Copy to another machine or a bucket** with a tool you already trust (`rclone`, `restic`, `rsync`, `scp`):
   ```bash
   rclone copy /srv/alfheim/backups remote:alfheim-backups --include "alfheim-backup-*.tar.gz"
   ```
3. **Store the decryption key and a copy of the `.env` somewhere else than the server.** An encrypted backup you cannot decrypt is no backup.

---

## Restore from a backup

> **Restore replaces data.** `alfheim-setup restore` overwrites `.env` and the other secrets, drops and recreates every database and role from the dump, and wipes and refills the RustFS volume. It asks for confirmation unless `--yes` is given.

The simplest and safest path is a **fresh host**:

1. Install Docker and Docker Compose on the new host.
2. Copy the `alfheim-setup` binary and the archive over (decrypt it first if you encrypted it).
3. Restore into an empty directory:
   ```bash
   mkdir -p /srv/alfheim && cd /srv/alfheim
   alfheim-setup restore /path/to/alfheim-backup-20261020T030000Z.tar.gz
   ```
4. Point DNS at the new host if its address changed.

What `restore` does:

1. Extracts the archive into a staging directory and verifies every entry against the checksums in `manifest.json`. A corrupt, truncated or tampered archive is rejected before anything on disk changes.
2. Shows what the archive contains and asks for confirmation.
3. Stops the stack (if one exists in the directory).
4. Restores the files. Files it overwrites are first copied to `.alfheim-backups/<timestamp>/`.
5. Starts only PostgreSQL, drops every existing database and role (except the superuser), and replays `database.sql`.
6. Wipes and refills the RustFS volume, if the archive includes it.
7. Pulls the images for the restored `IMAGE_TAG`, starts the whole stack and runs `scripts/verify-stack.sh`.

Restoring over a running production installation works the same way, but destroys its current data. Take a fresh `alfheim-setup backup` first if you might need it. A checksum protects against corruption, not against someone who can rewrite the whole archive: only restore archives you trust.

The restored installation runs the release recorded in the backup. Run [`alfheim-setup update`](./update-installation.md) afterwards to move to a newer one.

---

## Restore drill

A backup is only proven by a restore. Do this once after setting up backups, and again every few months:

1. Take a backup: `alfheim-setup backup`.
2. Provision a scratch VM (or a spare machine) with Docker. It does not need public DNS for the drill.
3. Copy the binary and the archive, then run `alfheim-setup restore <archive> --install-dir /srv/alfheim-drill`.
4. Confirm that `scripts/verify-stack.sh` passes, that you can sign in with your existing account, and that your data and uploaded files are there.
5. Write down how long it took and what you had to look up. That is your recovery time.
6. Delete the scratch VM.

---

## Backup before every update

`alfheim-setup update` takes a backup of the databases and secrets (without the object storage) **before** it downloads, replaces or restarts anything. It prints the archive path. If the backup fails, the update is aborted with nothing changed.

Run `alfheim-setup update --skip-backup` only when you have your own current backup, or when the stack is down and you accept updating without one.

To roll back a bad update including its data, run `alfheim-setup restore` with the pre-update archive.

---

## Troubleshooting

**"cannot reach postgres-core (is the stack running?)"** — start the stack (`docker compose -f compose.prod.yaml up -d`) and retry.

**"the database dump is incomplete"** — the `pg_dumpall` stream ended early (container restart, disk full). Free space and retry; no archive is written.

**"checksum mismatch"** on restore — the file was corrupted in transit or changed. Fetch the archive again from your off-site copy.

**Restore stops with "must be set"** — the `.env` inside an old archive lacks a variable that the `compose.prod.yaml` in the same archive requires. Both come from the same release, so this indicates a hand-edited archive or a manually changed `.env`.

---

## See also

* [Update an installation](./update-installation.md)
* [alfheim-setup CLI reference](../reference/installer-cli.md)
* [Secrets hardening](./secrets-hardening.md)
* [PostgreSQL Core Service](../../../infrastructure/postgres/README.md)
