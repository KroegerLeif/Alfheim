---
title: "Speicher-Layout planen"
description: "Welche Alfheim-Daten wo liegen, wie sie wachsen, wie du sie auf getrennte Platten legst und welche ZFS- und Btrfs-Einstellungen zu welcher Klasse passen."
---

Nutze diese Anleitung, bevor du Alfheim eigene Platten gibst oder wenn die Systemplatte voll läuft. Standardmäßig liegt jede Datenklasse in einem benannten Docker-Volume unter `/var/lib/docker/volumes`. Die vier großen Klassen kannst du mit den Variablen `ALFHEIM_*_DATA_PATH` in Host-Verzeichnisse verlegen (siehe [Datenverzeichnisse](../reference/environment-variables.md#datenverzeichnisse)).

## Welche Daten wo liegen

| Daten | Standardort | Variable zum Verlegen | Wachstum |
| :--- | :--- | :--- | :--- |
| PostgreSQL: alle App-Datenbanken, Zitadel | Volume `postgres_core_data` | `ALFHEIM_DB_DATA_PATH` | Langsam. Text und JSON (Chat-Nachrichten, Audit-Payloads); für einen Haushalt lange Zeit einige hundert MB. Treiber ist vor allem der Chat-Verlauf. |
| RustFS-Objekte: Budget-Belege, Bibliotheks-Anleitungen, Chat-Bilder | Volume `rustfs_data` | `ALFHEIM_OBJECT_DATA_PATH` | Die größte und am schwersten vorhersagbare Klasse: Sie wächst mit jedem Upload. Belege und Chat-Bilder liegen als kleine WebP- oder JPEG-Dateien, Anleitungen als hochgeladenes PDF (standardmäßig bis 50 MiB). |
| Metriken (VictoriaMetrics) | Volume `victoriametrics_data` | `ALFHEIM_METRICS_DATA_PATH` | Begrenzt: Aufbewahrung 14 Tage. |
| Logs (VictoriaLogs) | Volume `victorialogs_data` | `ALFHEIM_LOGS_DATA_PATH` | Begrenzt: Aufbewahrung 7 Tage. |
| Caddy-Zertifikate und ACME-Zustand | Volume `caddy_data`; eigene Zertifikate in `./data/caddy/certs/` | keine | Kilobytes. Sichern, braucht aber keine eigene Platte. |
| Grafana-Zustand | Volume `grafana_data` | keine | Klein. |

Die Größenangaben sind Größenordnungen, keine Messwerte: Beobachte nach einigen Wochen `docker system df -v` und plane mit deinen eigenen Zahlen.

## Empfohlenes Layout

* **PostgreSQL auf die schnellste Platte** (NVMe oder SSD). Jede Anfrage berührt sie, und das Write-Ahead-Log ist latenzempfindlich.
* **Objekte auf Massenspeicher** (größere, langsamere Platte oder ein per NAS eingebundenes Verzeichnis). Sie werden selten gelesen und als ganze Dateien geschrieben.
* **Metriken und Logs** können auf der Systemplatte bleiben, weil die Aufbewahrung sie begrenzt. Verlege sie nur, wenn du die Aufbewahrung verlängerst.
* Lege das **Backup-Ziel nicht auf diese Platten** (siehe [Backup, Restore & Datenmigration](./backup-restore.md)).

Setze die Pfade bei der Installation, zum Beispiel:

```bash
sudo ./alfheim-setup \
  --db-data-path /mnt/nvme/alfheim/postgres \
  --object-data-path /mnt/bulk/alfheim/objects
```

`alfheim-setup` legt jedes Verzeichnis mit dem Besitzer an, den der Container braucht (`70:70` für PostgreSQL, `10001:10001` für RustFS), prüft die Schreibbarkeit und warnt, wenn es noch auf demselben Dateisystem wie `/` liegt. Binde die Platte zuerst ein, sonst landen die Daten unter dem Einhängepunkt auf der Systemplatte.

Um eine bestehende Installation umzuziehen, erstelle ein Backup, stoppe den Stack, setze die Variable (`alfheim-setup --reconfigure` mit dem Flag) und stelle wieder her. Kopiere keine Volume-Verzeichnisse von Hand. Die Schritte stehen in [Backup, Restore & Datenmigration](./backup-restore.md).

## Dateisystem-Einstellungen

Die Einstellungen gelten für das Dataset oder Dateisystem, das das Verzeichnis enthält. Optimiere nur, was du messen kannst; dies sind Ausgangspunkte.

### ZFS

| Dataset | Einstellungen | Grund |
| :--- | :--- | :--- |
| PostgreSQL | `recordsize=16K`, `compression=lz4` | 16K liegt nahe an der 8K-Seite von PostgreSQL und vermeidet das Umschreiben großer Records. Heap-Seiten und Write-Ahead-Log lassen sich gut komprimieren. |
| Objekte | `compression=zstd` (oder `lz4`), Standard-`recordsize` | Ganze Dateien werden einmal geschrieben. Siehe Hinweis zur Kompression unten. |

```bash
zfs create -o recordsize=16K -o compression=lz4 -o atime=off tank/alfheim/postgres
zfs create -o compression=zstd -o atime=off tank/alfheim/objects
```

### Btrfs

Binde das Dateisystem mit den Daten mit `compress=zstd:3` ein. Verwende **nicht** `nodatacow` für PostgreSQL: Es wird für Datenbankdateien oft empfohlen, schaltet aber Datenprüfsummen und Kompression für diese Dateien ab, sodass stille Datenkorruption unbemerkt bliebe. Wird die Copy-on-Write-Fragmentierung nachweislich zum Problem, plane stattdessen regelmäßig `btrfs filesystem defragment` ein.

### Hinweis zur Kompression

Dateisystem-Kompression bringt beim Objektspeicher wenig: Belege und Chat-Bilder sind bereits WebP oder JPEG, PDFs sind bereits komprimiert. PostgreSQL-Heap und Write-Ahead-Log lassen sich gut komprimieren; deshalb nutzt der Stack für große Spaltenwerte LZ4 (`default_toast_compression=lz4`). Ist die CPU knapp, kannst du das Objekt-Dataset unkomprimiert lassen, ohne viel zu verlieren.

## Docker-Logs

Container-Logs gehören nicht zu den Alfheim-Datenverzeichnissen. Docker legt sie je Container unter `/var/lib/docker/containers/<id>/` ab (Treiber `json-file`). `compose.prod.yaml` begrenzt jeden Dienst auf 3 Dateien à 10 MB, und die Compose-Prüfung in der CI (`scripts/check-compose.py`) schlägt fehl, wenn einem Dienst dieses Limit oder ein Speicherlimit fehlt. Im ungünstigsten Fall sind das etwa 30 MB je Container. Willst du ein anderes Limit für den ganzen Host, setze es in `/etc/docker/daemon.json` (`log-opts`); es gilt für danach erstellte Container.

## Siehe auch

* [Backup, Restore & Datenmigration](./backup-restore.md)
* [Self-Hosting- & Installationsanleitung](./homelab-deployment.md)
* [Umgebungsvariablen: Datenverzeichnisse](../reference/environment-variables.md#datenverzeichnisse)
* [alfheim-setup CLI-Referenz](../reference/installer-cli.md)
