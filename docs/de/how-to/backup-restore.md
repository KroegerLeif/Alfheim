---
title: "Backup, Wiederherstellung & Datenmigration"
description: "Eine Alfheim-Installation mit alfheim-setup sichern und wiederherstellen: Datenbanken, Objektspeicher und die nötigen Geheimnisse, inklusive nächtlichem Zeitplan, Off-Site-Kopien und Restore-Übung."
---

> **Kurzfassung:** `alfheim-setup backup` schreibt ein Archiv mit allen Datenbanken, dem RustFS-Objektspeicher und den Geheimnissen, die beides lesbar machen. `alfheim-setup restore <Archiv>` baut daraus eine Installation wieder auf, am besten auf einem frischen Host. `alfheim-setup update` sichert Datenbanken und Geheimnisse automatisch, bevor etwas geändert wird.

---

## 📋 Inhalt
- [Was ein Backup enthält](#was-ein-backup-enthält)
- [Ein Backup erstellen](#ein-backup-erstellen)
- [Nächtliche Backups planen](#nächtliche-backups-planen)
- [Kopien außerhalb des Hosts aufbewahren](#kopien-außerhalb-des-hosts-aufbewahren)
- [Aus einem Backup wiederherstellen](#aus-einem-backup-wiederherstellen)
- [Restore-Übung](#restore-übung)
- [Backup vor jedem Update](#backup-vor-jedem-update)
- [Fehlerbehebung](#fehlerbehebung)

---

## Was ein Backup enthält

Ein Archiv `alfheim-backup-<UTC>.tar.gz` mit Zeitstempel (Modus `0600`):

| Eintrag | Wozu er nötig ist |
| :--- | :--- |
| `database.sql` | `pg_dumpall` des gesamten `postgres-core`-Clusters: alle `alfheim_<app>`-Datenbanken, die Zitadel-Datenbank (Benutzer, Projekte, OIDC-Clients) und alle Rollen. |
| `rustfs-data.tar` | Das RustFS-Volume mit hochgeladenen Dateien (Budget-Belege, Bibliotheks-PDFs). Entfällt bei `--skip-media` und beim Backup vor einem Update. |
| `files/.env` | Alle Geheimnisse. Ohne `ZITADEL_MASTERKEY` ist die Zitadel-Datenbank nicht lesbar; ohne die Anwendungsschlüssel gehen verschlüsselte Werte wie gespeicherte Chat-API-Schlüssel verloren. |
| `files/infrastructure/zitadel/machinekey/` | Das Zitadel-Bootstrap-Token. |
| `files/infrastructure/ca/`, `files/infrastructure/caddy/pki/` | Die erzeugte Root-CA (`--tls internal`). Ohne sie muss jedes Gerät einer neuen CA vertrauen. |
| `files/` Stack-Dateien | `compose.prod.yaml`, Caddyfile, Telemetrie- und Postgres-Init-Konfiguration, `.alfheim.installed`. |
| `manifest.json` | Release (`IMAGE_TAG`), PostgreSQL-Version, Installer-Version und eine SHA-256-Prüfsumme je Eintrag. |

> **Das Archiv enthält alle Geheimnisse im Klartext.** Behandle es wie die `.env`:
> privat halten und verschlüsseln, bevor es den Host verlässt.

Metriken und Logs (VictoriaMetrics, VictoriaLogs, Grafana) werden nicht gesichert; sie entstehen aus dem laufenden System neu.

---

## Ein Backup erstellen

Der Stack muss laufen, da der Dump über den `postgres-core`-Container erstellt wird. Aus dem Installationsverzeichnis:

```bash
alfheim-setup backup
```

| Flag | Standard | Bedeutung |
| :--- | :--- | :--- |
| `--output DIR` (`ALFHEIM_BACKUP_DIR`) | `<install-dir>/backups` | Zielverzeichnis der Archive. Wird mit Modus `0700` angelegt. |
| `--keep N` | `7` | Die `N` neuesten Archive behalten, ältere löschen. Gelöscht werden nur Dateien namens `alfheim-backup-<Zeitstempel>.tar.gz`. |
| `--skip-media` | aus | RustFS-Objektspeicher weglassen (deutlich kleineres, schnelleres Archiv). |
| `--install-dir DIR` (`ALFHEIM_INSTALL_DIR`) | aktuelles Verzeichnis | Installationswurzel. |

Der Befehl endet mit einem Fehlercode und hinterlässt kein halbes Archiv, wenn der Dump unvollständig ist oder ein Schritt fehlschlägt.

Hinweise:

- Der Dump läuft ohne TTY und nutzt `POSTGRES_USER` aus der `.env`; ein abweichender Datenbankbenutzer funktioniert also.
- Das RustFS-Volume wird bei laufendem Stack über einen kurzlebigen `alpine`-Container gelesen. Für einen exakt konsistenten Stand von Uploads und Datenbank das Backup in einer ruhigen Phase ausführen.
- Das erste Medien-Backup lädt das Image `alpine:3.20`.

---

## Nächtliche Backups planen

### systemd-Timer (empfohlen)

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
# Optionale Off-Site-Kopie, siehe nächster Abschnitt:
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

Prüfe `journalctl -u alfheim-backup.service` (oder die Logdatei) regelmäßig: Ein Backup, dessen Ergebnis niemand liest, kann monatelang unbemerkt fehlschlagen.

---

## Kopien außerhalb des Hosts aufbewahren

Ein Backup auf demselben Datenträger überlebt weder einen Plattenausfall noch Diebstahl oder Ransomware. Folge der 3-2-1-Regel: drei Kopien, zwei Medien, eine außer Haus.

1. **Vor dem Upload verschlüsseln**, da das Archiv Geheimnisse enthält:
   ```bash
   age -r age1deinoeffentlicherschluessel... -o "$f.age" "$f"      # oder: gpg --encrypt --recipient du@example.com "$f"
   ```
2. **Auf einen anderen Rechner oder in einen Bucket kopieren** mit einem Werkzeug deines Vertrauens (`rclone`, `restic`, `rsync`, `scp`):
   ```bash
   rclone copy /srv/alfheim/backups remote:alfheim-backups --include "alfheim-backup-*.tar.gz"
   ```
3. **Den Entschlüsselungsschlüssel und eine Kopie der `.env` an einem anderen Ort als dem Server aufbewahren.** Ein verschlüsseltes Backup, das du nicht entschlüsseln kannst, ist kein Backup.

---

## Aus einem Backup wiederherstellen

> **Restore ersetzt Daten.** `alfheim-setup restore` überschreibt `.env` und die übrigen Geheimnisse, löscht und erstellt jede Datenbank und Rolle aus dem Dump neu und leert und befüllt das RustFS-Volume neu. Ohne `--yes` wird vorher nachgefragt.

Der einfachste und sicherste Weg ist ein **frischer Host**:

1. Docker und Docker Compose auf dem neuen Host installieren.
2. Die Binärdatei `alfheim-setup` und das Archiv hinüberkopieren (vorher entschlüsseln, falls verschlüsselt).
3. In ein leeres Verzeichnis wiederherstellen:
   ```bash
   mkdir -p /srv/alfheim && cd /srv/alfheim
   alfheim-setup restore /pfad/zu/alfheim-backup-20261020T030000Z.tar.gz
   ```
4. DNS auf den neuen Host umstellen, falls sich die Adresse geändert hat.

Was `restore` tut:

1. Entpackt das Archiv in ein Staging-Verzeichnis und prüft jeden Eintrag gegen die Prüfsummen in `manifest.json`. Ein beschädigtes, abgeschnittenes oder manipuliertes Archiv wird abgelehnt, bevor sich auf der Platte etwas ändert.
2. Zeigt den Inhalt des Archivs und fragt nach Bestätigung.
3. Stoppt den Stack (falls im Verzeichnis einer existiert).
4. Stellt die Dateien wieder her. Überschriebene Dateien werden vorher nach `.alfheim-backups/<Zeitstempel>/` kopiert.
5. Startet nur PostgreSQL, löscht alle vorhandenen Datenbanken und Rollen (außer dem Superuser) und spielt `database.sql` ein.
6. Leert und befüllt das RustFS-Volume neu, sofern das Archiv es enthält.
7. Lädt die Images für den wiederhergestellten `IMAGE_TAG`, startet den gesamten Stack und führt `scripts/verify-stack.sh` aus.

Das Wiederherstellen über eine laufende Produktivinstallation funktioniert genauso, zerstört aber deren aktuelle Daten. Erstelle vorher ein frisches `alfheim-setup backup`, falls du sie noch brauchen könntest. Eine Prüfsumme schützt vor Beschädigung, nicht vor jemandem, der das ganze Archiv neu schreiben kann: Stelle nur Archive wieder her, denen du vertraust.

Die wiederhergestellte Installation läuft mit dem im Backup vermerkten Release. Führe danach [`alfheim-setup update`](./update-installation.md) aus, um auf ein neueres zu wechseln.

---

## Restore-Übung

Ein Backup ist erst durch einen Restore bewiesen. Mache das einmal nach dem Einrichten der Backups und danach alle paar Monate:

1. Backup erstellen: `alfheim-setup backup`.
2. Eine Test-VM (oder einen Ersatzrechner) mit Docker bereitstellen. Öffentliches DNS ist für die Übung nicht nötig.
3. Binärdatei und Archiv kopieren, dann `alfheim-setup restore <Archiv> --install-dir /srv/alfheim-drill` ausführen.
4. Prüfen, dass `scripts/verify-stack.sh` erfolgreich ist, dass die Anmeldung mit deinem bestehenden Konto klappt und dass Daten und hochgeladene Dateien vorhanden sind.
5. Notieren, wie lange es gedauert hat und was du nachschlagen musstest. Das ist deine Wiederherstellungszeit.
6. Die Test-VM löschen.

---

## Backup vor jedem Update

`alfheim-setup update` sichert Datenbanken und Geheimnisse (ohne Objektspeicher), **bevor** etwas heruntergeladen, ersetzt oder neu gestartet wird, und gibt den Archivpfad aus. Schlägt das Backup fehl, wird das Update abgebrochen, ohne dass sich etwas geändert hat.

`alfheim-setup update --skip-backup` nur verwenden, wenn du ein eigenes aktuelles Backup hast oder der Stack steht und du ohne Backup aktualisieren willst.

Um ein misslungenes Update samt Daten zurückzurollen, führe `alfheim-setup restore` mit dem Archiv vor dem Update aus.

---

## Fehlerbehebung

**„cannot reach postgres-core (is the stack running?)“** — den Stack starten (`docker compose -f compose.prod.yaml up -d`) und erneut versuchen.

**„the database dump is incomplete“** — der `pg_dumpall`-Strom endete vorzeitig (Container-Neustart, Platte voll). Platz schaffen und wiederholen; es wird kein Archiv geschrieben.

**„checksum mismatch“** beim Restore — die Datei wurde beim Transport beschädigt oder verändert. Das Archiv erneut aus der Off-Site-Kopie holen.

**Restore bricht mit „must be set“ ab** — in der `.env` eines alten Archivs fehlt eine Variable, die die `compose.prod.yaml` desselben Archivs verlangt. Beide stammen aus demselben Release; das deutet auf ein von Hand verändertes Archiv oder eine manuell geänderte `.env` hin.

---

## Siehe auch

* [Eine Installation aktualisieren](./update-installation.md)
* [alfheim-setup CLI-Referenz](../reference/installer-cli.md)
* [Secrets-Härtung](./secrets-hardening.md)
* [PostgreSQL-Core-Service](../../../infrastructure/postgres/README.md)
