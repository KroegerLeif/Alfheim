---
title: "Eine Installation aktualisieren"
description: "Eine produktive Alfheim-Installation mit einem Befehl auf ein neues Release aktualisieren, ohne den Assistenten erneut auszuführen, Secrets neu zu generieren oder sich erneut anzumelden."
---

> **TL;DR:** `curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | ALFHEIM_VERSION=vX.Y.Z bash -s -- update` lädt die Stack-Dateien dieses Releases herunter, sichert die vorherigen und startet neu — kein Assistent, keine neuen Secrets, keine Root-CA, kein erneutes Login. Kommst du von v0.4.x oder älter? Lies zuerst [Aktualisieren von v0.4.x](#aktualisieren-von-v04x).

---

## 📋 Inhaltsverzeichnis
- [Voraussetzungen](#voraussetzungen)
- [Der Einzeiler](#der-einzeiler)
- [Die Binärdatei direkt ausführen](#die-binärdatei-direkt-ausführen)
- [Was erhalten bleibt](#was-erhalten-bleibt)
- [Was tatsächlich passiert](#was-tatsächlich-passiert)
- [Das Ergebnis überprüfen](#das-ergebnis-überprüfen)
- [Aktualisieren von v0.4.x](#aktualisieren-von-v04x)
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
- Das Zitadel-Machinekey-Verzeichnis (`infrastructure/zitadel/machinekey/`), außer dass ein
  darin übrig gebliebenes Bootstrap-PAT widerrufen und gelöscht wird
- Irgendein Docker-Volume (Datenbanken, Objektspeicher, …)
- Das bereits provisionierte Zitadel-Projekt und die OIDC-Clients — das
  Administratorkonto, dessen Passwort und der Login jeder App funktionieren
  danach genau wie vorher.

Es ersetzt lediglich `compose.prod.yaml`, die OpenTelemetry-Collector-Konfiguration,
das Postgres-Init-Skript und `vector.toml` durch die Kopien des Ziel-Releases,
setzt `IMAGE_TAG` in der `.env` und hängt ein Secret an, das ein neueres
Release benötigt, aber in der `.env` noch fehlt (bestehende Werte werden nie rotiert).

Das Caddyfile ist kein Release-Asset, sondern wird vom Installer erzeugt.
`update` rendert es aus der in der `.env` gespeicherten Konfiguration neu
(Hosts, Schema, `ALFHEIM_TLS_STRATEGY`, `ACME_EMAIL`, `ALFHEIM_ENABLED_APPS`), sodass Ingress-Korrekturen
wie neue Sicherheits-Header oder Routen auch bestehende Installationen
erreichen. Das bisherige Caddyfile ist Teil der Sicherung. Eine Installation,
deren `.env` kein `ALFHEIM_TLS_STRATEGY` enthält (eine ältere Klartext-HTTP-Installation),
behält ihr Caddyfile und erhält eine Warnung; dort `alfheim-setup --reconfigure`
ausführen.

---

## Was tatsächlich passiert

1. Verweigert die Ausführung, sofern keine bestehende Installation gefunden
   wird (`.env` vorhanden).
2. Ermittelt die Zielversion aus `--version` oder aus der eigenen
   Build-Version dieser Binärdatei — niemals `latest`.
3. Lädt die Stack-Dateien des Ziel-Releases herunter und verifiziert sie
   gegen dessen `SHA256SUMS`.
4. Erstellt ein [Backup](./backup-restore.md) von Datenbanken und Secrets
   (`backups/alfheim-backup-<UTC-Zeitstempel>.tar.gz`, ohne Objektspeicher)
   und gibt den Pfad aus. Schlägt das fehl, bricht das Update ab, bevor sich
   etwas ändert; `--skip-backup` überspringt den Schritt. Für den Datenbank-Dump
   muss der Stack laufen.
5. Sichert die aktuellen Stack-Dateien in ein Verzeichnis mit Zeitstempel
   (`.alfheim-backups/<UTC-Zeitstempel>/`), bevor irgendetwas ersetzt wird.
6. Ersetzt `compose.prod.yaml` und die weiteren Stack-Dateien, setzt
   `IMAGE_TAG` in der `.env` und rendert das Caddyfile aus der gespeicherten
   Konfiguration neu.
7. Hängt jedes Secret an, das ein neueres Release benötigt und das in der
   `.env` fehlt.
8. Gleicht das Zitadel-Projekt und die OIDC-Clients erneut ab (idempotent —
   fügt eine fehlende Redirect-URI hinzu, ändert nichts bereits Passendes) und
   stellt sicher, dass die Selbstregistrierung in der Zitadel-Login-Policy
   deaktiviert ist. Konten legt der Betreiber an, nie ein Besucher der
   Login-Seite. Dazu meldet es sich mit einem kurzlebigen Token aus dem
   gespeicherten Zitadel-Maschinenschlüssel an und rotiert den Schlüssel (eine
   ältere Installation migriert von ihrem Bootstrap-PAT; siehe
   [Aktualisieren von v0.4.x](#bootstrap-pat-durch-einen-maschinenschlüssel-ersetzt)).
   Bei einer bestehenden Installation bricht der Abgleich selbst das Update nie
   ab: fehlen dem Token die Rechte oder lässt sich die Policy nicht ändern oder
   verifizieren, läuft das Update weiter und gibt
   eine deutliche Warnung aus (erneut in der Abschlusszusammenfassung), dass
   die Selbstregistrierung noch aktiv sein kann. Dann in der Zitadel-Konsole
   von Hand deaktivieren: **Default settings → Login behavior and security →
   „User registration allowed" abwählen**, ebenso in den Login-Einstellungen
   der Organisation, falls diese eine eigene Policy hat. Eine Neuinstallation
   schlägt stattdessen fehl.
9. Stellt sicher, dass jede Dienst-Datenbank existiert (erneuter Lauf des
   idempotenten Postgres-Init-Skripts).
10. `docker compose pull`, gefolgt von `docker compose up -d --remove-orphans`,
    mit `COMPOSE_PROFILES` aus `ALFHEIM_ENABLED_APPS`. Nur die aktivierten Apps
    werden geladen und gestartet; eine deaktivierte App bleibt aus und behält
    ihre Daten. Eine Installation aus der Zeit vor der App-Auswahl hat kein
    `ALFHEIM_ENABLED_APPS`; `update` trägt dort jede App ein, sodass weiterhin
    alles läuft (siehe [das `apps`-Subkommando](../reference/installer-cli.md#das-apps-subkommando)).
    Unterscheidet sich das neu gerenderte Caddyfile vom bisherigen, wird auch
    Caddy neu gestartet, da er ein geändertes Caddyfile nicht selbst nachlädt.
11. Führt [`scripts/verify-stack.sh`](#das-ergebnis-überprüfen) gegen den
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
Anfrage ohne Bearer-Token ablehnt. Versendet Zitadel E-Mails über Mailpit
(`ALFHEIM_SMTP_HOST=mailpit`, der lokale Stack), fordert es außerdem für
einen Wegwerf-Benutzer eine Passwort-Zurücksetzung an und wartet auf die
E-Mail in Mailpit; gegen jeden anderen Mailserver wird diese Prüfung
übersprungen, sodass ein Update nie eine Test-E-Mail verschickt. Es endet mit einem Exit-Code ungleich
null und einer lesbaren Zusammenfassung, falls etwas fehlschlägt.

---

## Aktualisieren von v0.4.x

Das Release nach v0.4.x ändert zwei Infrastrukturkomponenten und die Art, wie sich der
Installer bei Zitadel anmeldet. Jede Änderung betrifft eine bestehende Installation einmal,
beim ersten Update.

### Zitadel v2.66 auf v4

Zitadel wechselt von v2.66.1 auf v4.20.3 und migriert seine Datenbank beim ersten Start an Ort
und Stelle; es ist kein manueller Schritt nötig und es gehen keine Daten verloren. Instanzen
behalten das eingebaute Login V1 unter `/ui/login`, die Anmeldeseite sieht also gleich aus.

v4 signiert Tokens nur noch mit neu erzeugten Web Keys, daher wird jedes vor dem Update
ausgestellte Token abgelehnt:

1. Das Update wie gewohnt ausführen.
2. Warten, bis `alfheim_zitadel` in `docker compose -f compose.prod.yaml ps` `healthy` meldet.
3. Sich auf jedem Gerät einmal neu anmelden. Benutzerkonten, Passwörter, Haushalte und die
   Rolle `alfheim_operator` bleiben unverändert.

Schlägt die Anmeldung in den ersten Minuten mit `Errors.WebKey.NoActive` fehl, siehe
[Fehlerbehebung](#fehlerbehebung). Hintergrund: [Zitadel-Version und Login-Oberfläche](../explanation/authentication-security.md#zitadel-version-und-login-oberfläche).

### Bootstrap-PAT durch einen Maschinenschlüssel ersetzt

Ältere Installationen bewahren in der `.env` ein persönliches Zitadel-Zugriffstoken (PAT) auf,
das nie abläuft (`ZITADEL_BOOTSTRAP_PAT`). Das erste Update verwendet es genau einmal: Es
speichert einen Maschinenschlüssel in `infrastructure/zitadel/provisioner/machine-key.json`
(Modus `0600`), widerruft in Zitadel jedes PAT des Provisioning-Maschinenbenutzers, löscht
`infrastructure/zitadel/machinekey/pat.txt` und leert `ZITADEL_BOOTSTRAP_PAT`. Außerdem
ergänzt es `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE`, das die neue `compose.prod.yaml`
voraussetzt. Ein manueller Schritt ist nicht nötig. Danach prüfen:

```bash
grep '^ZITADEL_BOOTSTRAP_PAT=' .env                        # gibt einen leeren Wert aus
ls -l infrastructure/zitadel/provisioner/machine-key.json  # -rw------- und gehört dem Benutzer des Installers
```

Jeder Lauf setzt außerdem `infrastructure/zitadel/provisioner/` auf Modus `0700` und schiebt
`ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE` um eine Woche nach vorn, wenn das Datum schon in der
Vergangenheit liegt. Zitadel liest dieses Datum nur, wenn es eine neue Instanz anlegt. Das
passiert erneut, wenn die Datenbank gelöscht, die `.env` aber behalten wurde, und Zitadel lehnt
ein abgelaufenes Datum ab.

Backups von vor dem Update enthalten noch das alte PAT, das gegen die laufende Instanz nicht
mehr funktioniert. Hintergrund: [Wie sich der Installer bei Zitadel anmeldet](../explanation/authentication-security.md#wie-sich-der-installer-bei-zitadel-anmeldet).

### PostgreSQL 16 auf 18

`postgres-core` wechselt von `postgres:16-alpine` auf `postgres:18-alpine`, und die Daten
werden unter `/var/lib/postgresql` eingehängt (das 18er-Image legt seinen Cluster darunter in
`18/docker` ab). **Es gibt kein Upgrade an Ort und Stelle.** Einen von PostgreSQL 16 angelegten
Cluster kann PostgreSQL 18 nicht öffnen, und weder `update` noch `restore` konvertiert ihn.

Eine auf PostgreSQL 16 angelegte Installation nicht an Ort und Stelle aktualisieren, sondern
neu aufsetzen:

1. Auf dem alten Release ein vollständiges Backup einschließlich Objektspeicher erstellen und
   vom Host kopieren: `alfheim-setup backup` ([Backup und Wiederherstellung](./backup-restore.md)).
2. Das neue Release in ein neues, leeres Installationsverzeichnis (oder auf einen neuen Host)
   installieren, wie im [Tutorial zur ersten Installation](../tutorials/first-run.md). Sein
   PostgreSQL-18-Cluster startet leer und mit aktivierten Daten-Prüfsummen.

`alfheim-setup` hat keinen Befehl, der die Daten des alten Clusters in den neuen überträgt. Die
`database.sql` im Backup-Archiv ist ein einfacher `pg_dumpall`, den PostgreSQL 18 lesen kann;
ihn in eine neue Installation einzuspielen ist jedoch ein manueller Datenbankvorgang außerhalb
des Installers.

`alfheim-setup restore` eines v0.4.x-Archivs ist kein Migrationsweg: Es stellt die Stack-Dateien
dieses Archivs wieder her, die PostgreSQL 16 festschreiben, sodass die wiederhergestellte
Installation wieder das alte Release ausführt. Installationen, die auf PostgreSQL 18 angelegt
wurden, betrifft dieser Abschnitt nicht. Wo der Cluster liegt:
[Datenverzeichnisse](../reference/environment-variables.md#datenverzeichnisse).

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

Hat das neue Release eine Datenbank so migriert, dass das alte sie nicht mehr
lesen kann, rolle auch die Daten zurück: das Archiv vor dem Update aus
`backups/` mit `alfheim-setup restore` einspielen (siehe
[Backup, Wiederherstellung & Datenmigration](./backup-restore.md)).

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

**Anmeldung schlägt direkt nach dem Update von v0.4.x oder älter fehl** — dieses
Update hebt Zitadel von v2.66 auf v4, das Tokens nur noch mit neu erzeugten Web
Keys signiert. Jeder Benutzer muss sich neu anmelden. In den ersten Minuten
beantwortet Zitadel Token-Anfragen eventuell mit `Errors.WebKey.NoActive` (und
`GET /oauth/v2/keys` mit einer leeren Schlüsselliste), bis es seine Projektionen
nachgezogen hat; abwarten und erneut versuchen, es ist nichts zu tun.

**„the stored machine key … was rejected and no bootstrap PAT is available"** — der
Zitadel-Maschinenschlüssel ist abgelaufen (90 Tage ohne Provisioning-Lauf) oder gehört
zu einer anderen Installation. In der Zitadel-Konsole als IAM-Owner anmelden, unter
**Users → Service Users** den Maschinenbenutzer `alfheim-bootstrap` öffnen, ein
persönliches Zugriffstoken mit einem Tag Laufzeit erstellen und in der `.env` als
`ZITADEL_BOOTSTRAP_PAT` eintragen. Das Update erneut ausführen; es speichert einen neuen
Schlüssel, widerruft das Token und leert den Wert wieder.

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
