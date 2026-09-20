---
title: "Eine Installation aktualisieren"
description: "Eine produktive Alfheim-Installation mit einem Befehl auf ein neues Release aktualisieren, ohne den Assistenten erneut auszuführen, Secrets neu zu generieren oder sich erneut anzumelden."
---

> **TL;DR:** `curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | ALFHEIM_VERSION=vX.Y.Z bash -s -- update` lädt die Stack-Dateien dieses Releases herunter, sichert die vorherigen und startet neu — kein Assistent, keine neuen Secrets, keine Root-CA, kein erneutes Login.

---

## 📋 Inhaltsverzeichnis
- [Voraussetzungen](#voraussetzungen)
- [Der Einzeiler](#der-einzeiler)
- [Die Binärdatei direkt ausführen](#die-binärdatei-direkt-ausführen)
- [Was erhalten bleibt](#was-erhalten-bleibt)
- [Was tatsächlich passiert](#was-tatsächlich-passiert)
- [Das Ergebnis überprüfen](#das-ergebnis-überprüfen)
- [Zurückrollen](#zurückrollen)
- [Fehlerbehebung](#fehlerbehebung)

---

## Voraussetzungen

- Eine abgeschlossene Alfheim-Installation (eine `.env` und `.alfheim.installed`
  im Installationsverzeichnis — siehe [Tutorial: Ihre erste Installation](../tutorials/first-run.md)).
- SSH-Zugriff auf den Host, im Installationsverzeichnis (z. B. `/srv/alfheim`).
- Das Ziel-Release-Tag, z. B. `v1.4.0`. Siehe die
  [Releases-Seite](https://github.com/KroegerLeif/Alfheim/releases) für die Änderungen.

---

## Der Einzeiler

Im Installationsverzeichnis:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh \
  | ALFHEIM_VERSION=v1.4.0 bash -s -- update
```

Dies lädt die `alfheim-setup`-Binärdatei von `v1.4.0` herunter (verifiziert
gegen die `SHA256SUMS` dieses Releases, genau wie bei einer Neuinstallation)
und übergibt dann an dessen `update`-Subkommando, das die eigene
`compose.prod.yaml` von `v1.4.0` sowie die weiteren Standalone-Stack-Dateien
herunterlädt und verifiziert.

`ALFHEIM_VERSION` weglassen, um auf das neueste stabile Release zu aktualisieren:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash -s -- update
```

`--yes` nach `update` anhängen, um die Bestätigungsabfrage in einem
nicht-interaktiven Kontext wie Cron oder CI zu überspringen:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh \
  | ALFHEIM_VERSION=v1.4.0 bash -s -- update --yes
```

Eine bestehende Installation (ein Marker `.alfheim.installed` im aktuellen
Verzeichnis) führt `update` sogar **ganz ohne** Argumente automatisch erneut
aus, und `ALFHEIM_UPDATE=1` erzwingt den Update-Modus unabhängig von der
Argumentreihenfolge — damit funktioniert der exakte Einzeiler aus
[Tutorial: Deine erste Installation](../tutorials/first-run.md) unverändert
aus einem Cronjob oder Shell-Alias weiter, sobald die Installation
abgeschlossen ist.

---

## Die Binärdatei direkt ausführen

Falls `alfheim-setup` bereits auf dem Host vorhanden ist (oder Sie sie nicht
erneut herunterladen möchten), führen Sie das Subkommando direkt im
Installationsverzeichnis aus:

```bash
cd /srv/alfheim
alfheim-setup update --version v1.4.0
```

Wird `--version` weggelassen, zielt der Befehl auf die eigene Build-Version
dieser Binärdatei ab — niemals auf `latest` — sodass ein Update immer ein
exaktes, nachvollziehbares Release benennt. Vollständige Flag-Referenz:
[alfheim-setup CLI-Referenz](../reference/installer-cli.md#das-update-subkommando).

---

## Was erhalten bleibt

`update` rührt niemals an:

- `.env`-Secrets (Postgres-Passwörter, `ZITADEL_MASTERKEY`, JWT-Signierschlüssel, …)
- `infrastructure/ca/` (die Root-CA von `--tls internal`) oder `infrastructure/caddy/pki/`
- Den Zitadel-Machinekey und das Bootstrap-PAT (`infrastructure/zitadel/machinekey/`)
- Irgendein Docker-Volume (Datenbanken, Objektspeicher, …)
- Das bereits provisionierte Zitadel-Projekt und die OIDC-Clients — das
  Administratorkonto, dessen Passwort und der Login jeder App funktionieren
  danach genau wie vorher.

Es ersetzt lediglich `compose.prod.yaml`, die OpenTelemetry-Collector-Konfiguration,
das Postgres-Init-Skript und `vector.toml` durch die Kopien des Ziel-Releases,
setzt `IMAGE_TAG` in der `.env` und hängt ein Secret an, das ein neueres
Release benötigt, aber in der `.env` noch fehlt (bestehende Werte werden nie rotiert).

---

## Was tatsächlich passiert

1. Verweigert die Ausführung, sofern keine bestehende Installation gefunden
   wird (`.env` vorhanden).
2. Ermittelt die Zielversion aus `--version` oder aus der eigenen
   Build-Version dieser Binärdatei — niemals `latest`.
3. Lädt die Stack-Dateien des Ziel-Releases herunter und verifiziert sie
   gegen dessen `SHA256SUMS`.
4. Sichert die aktuellen Stack-Dateien in ein Verzeichnis mit Zeitstempel
   (`.alfheim-backups/<UTC-Zeitstempel>/`), bevor irgendetwas ersetzt wird.
5. Ersetzt `compose.prod.yaml` und die weiteren Stack-Dateien und setzt
   `IMAGE_TAG` in der `.env`.
6. Hängt jedes Secret an, das ein neueres Release benötigt und das in der
   `.env` fehlt.
7. Gleicht das Zitadel-Projekt und die OIDC-Clients erneut ab (idempotent —
   fügt eine fehlende Redirect-URI hinzu, ändert nichts bereits Passendes).
8. Stellt sicher, dass jede Dienst-Datenbank existiert (erneuter Lauf des
   idempotenten Postgres-Init-Skripts).
9. `docker compose pull`, gefolgt von `docker compose up -d --remove-orphans`.
10. Führt [`scripts/verify-stack.sh`](#das-ergebnis-überprüfen) gegen den
    neu gestarteten Stack aus und gibt eine Zusammenfassung aus.

Schlägt ein Schritt nach der Sicherung fehl, nennt die Fehlermeldung die
genauen Rollback-Befehle (siehe [Zurückrollen](#zurückrollen)) — nichts wird
automatisch rückgängig gemacht, da Container sich unter Umständen gerade
mitten im Neustart befinden.

---

## Das Ergebnis überprüfen

`update` führt `scripts/verify-stack.sh` selbst aus und gibt dessen
Zusammenfassung aus. Manuell ausführbar, jederzeit, sowohl gegen die
Produktionsinstallation als auch gegen den lokalen Dev-Stack:

```bash
./scripts/verify-stack.sh                    # erkennt compose.prod.yaml oder compose.yaml und .env im $PWD automatisch
./scripts/verify-stack.sh --dir /srv/alfheim # eine Installation an anderer Stelle prüfen
```

Es prüft, dass jeder Compose-Dienst gesund ist, dass Caddys `/livez` mit
`OK` antwortet, dass das OIDC-Discovery-Dokument den konfigurierten Issuer
nennt, dass jede App-Route über das Gateway ohne 5xx auflöst, dass
`/internal/*` am Rand blockiert ist, und dass die Household-API eine
Anfrage ohne Bearer-Token ablehnt. Es endet mit einem Exit-Code ungleich
null und einer lesbaren Zusammenfassung, falls etwas fehlschlägt.

---

## Zurückrollen

Schlägt `update` fehl, oder soll das neue Release doch nicht ausgeliefert
bleiben:

1. Die Dateien aus dem ausgegebenen Backup-Verzeichnis
   (`.alfheim-backups/<Zeitstempel>/`) zurück an ihren ursprünglichen Ort kopieren.
2. `IMAGE_TAG` in der `.env` wieder auf den vorherigen Wert setzen (die
   Fehlermeldung nennt ihn; er steht auch in der vorherigen
   `.alfheim.installed` bzw. in `docker compose config`).
3. Neu starten:
   ```bash
   docker compose -f compose.prod.yaml pull
   docker compose -f compose.prod.yaml up -d --remove-orphans
   ```

Da Secrets, die Root-CA und jedes Docker-Volume nie angerührt wurden, löst
ein Rollback nie erneut einen Assistenten aus, provisioniert Zitadel nicht
neu von Grund auf und verliert keine Daten.

---

## Fehlerbehebung

**„no existing installation found"** — `update` benötigt eine `.env` in
`--install-dir` (Standard: das aktuelle Verzeichnis). Im Verzeichnis der
ursprünglichen Installation ausführen, oder `--install-dir` übergeben.

**„no target version"** — eine lokal gebaute (keine Release-)Binärdatei hat
keine Version, auf die sie zurückfallen könnte; `--version vX.Y.Z` explizit übergeben.

**Prüfsummenfehler** — der Download war beschädigt oder wurde abgefangen;
Befehl erneut ausführen. Nichts auf der Festplatte wird angefasst, bevor
jede Datei verifiziert ist.

**Verifizierung schlägt nach erfolgreichem Neustart fehl** — der Stack ist
wieder hochgefahren, aber eine der Prüfungen unter
[Das Ergebnis überprüfen](#das-ergebnis-überprüfen) ist fehlgeschlagen.
`scripts/verify-stack.sh` erneut ausführen für die detaillierte Ausgabe pro
Prüfung, und siehe [Fehlerbehebung](./troubleshooting.md) für den
betroffenen Bereich (Ingress, Zitadel, eine bestimmte App).

---

## Siehe auch

* [alfheim-setup CLI-Referenz](../reference/installer-cli.md)
* [Tutorial: Ihre erste Installation](../tutorials/first-run.md)
* [Fehlerbehebung](./troubleshooting.md)
* [Backup, Restore & Datenmigration](./backup-restore.md)
