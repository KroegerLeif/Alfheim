---
title: "Ein Release Ende zu Ende prüfen"
description: "Checkliste, um einen Release-Kandidaten vor dem Wechsel von dev nach main auf einem wegwerfbaren, produktionsnahen Stack zu testen: Neuinstallation, Operator-Zugriff, Uploads, Backup, Update, Restore und das Upgrade vom vorherigen Release."
---

> **Kurzfassung:** Unit-Tests simulieren Docker und Zitadel nur. Bevor `dev` nach `main` geht, installierst du den Kandidaten mit `alfheim-setup` auf einem Wegwerf-Host, gehst die Prüfungen unten durch und führst danach Backup, Update, Löschen, Restore und das Upgrade vom vorherigen Tag aus. Jeder Schritt hat ein erwartetes Ergebnis. Jede Abweichung blockiert das Release.

---

## 📋 Inhaltsverzeichnis
- [Zuerst den Release-Dry-Run ausführen](#zuerst-den-release-dry-run-ausführen)
- [Wegwerf-Host vorbereiten](#wegwerf-host-vorbereiten)
- [1. Neuinstallation](#1-neuinstallation)
- [2. Beispieldaten und Backup](#2-beispieldaten-und-backup)
- [3. Update](#3-update)
- [4. Löschen und wiederherstellen](#4-löschen-und-wiederherstellen)
- [5. Upgrade vom vorherigen Release](#5-upgrade-vom-vorherigen-release)

---

## Zuerst den Release-Dry-Run ausführen

Bevor du etwas taggst, führst du den Release-Workflow im Dry-Run-Modus auf dem
Branch aus, den du veröffentlichen willst (meist `dev`):

```bash
gh workflow run release.yml --ref dev -f dry_run=true
gh run watch
```

Ein Dry-Run führt dieselben Qualitäts-Gates aus, baut jedes Image nativ für
`linux/amd64` (`ubuntu-24.04`) und `linux/arm64` (`ubuntu-24.04-arm`) und wendet
das Trivy-Gate an (behebbare CRITICAL- und HIGH-Funde lassen den Job
fehlschlagen). Er überspringt die Tag-Ancestry-Prüfung und veröffentlicht
nichts: Es wird kein Image gepusht, kein Manifest und kein Tag angelegt, kein
GitHub-Release erstellt und kein SARIF-Report an Code Scanning gesendet. Manuelle
Läufe mit `dry_run=false` werden abgelehnt; nur ein Tag-Push `v*.*.*` erzeugt
ein Release.

Der Lauf ist grün, wenn alle `Build <Image> (<Arch>)`-Jobs bestehen. Erst dann
pushst du den Tag.

**Schlägt das Trivy-Gate fehl**, öffne das Log des fehlgeschlagenen Jobs, lies
die Tabelle der Funde und behebe die Ursache auf `dev`: Hebe das verwundbare
Basis-Image oder die Abhängigkeit an (exakt gepinnt) oder baue neu, damit die
behobene Schicht des Basis-Images gezogen wird. Führe danach den Dry-Run erneut
aus. Ein Fund ohne verfügbaren Fix (`ignore-unfixed`) lässt das Gate nie
fehlschlagen. Tagge nicht, solange ein Dry-Run rot ist; ein Tag-Lauf scheitert
am selben Gate, nachdem die Tests schon gelaufen sind.

---

## Wegwerf-Host vorbereiten

- Eine Linux-VM oder ein freier Rechner mit Docker (amd64 oder arm64).
- Setze einen Pre-Release-Tag auf `dev`, zum Beispiel `v0.3.0-rc.1`. Der
  Release-Workflow baut dafür die Images und die Installer-Assets, und
  `install.sh` wählt ein Pre-Release nie automatisch aus, also bekommt es kein
  Betreiber versehentlich.
- Verwende `--tls internal` mit einer beliebigen Testdomain. Auf dem Rechner,
  von dem aus du testest, [vertraust du der lokalen Root-CA](trust-local-root-ca.md),
  oder du nutzt `*.localhost`-Namen, wenn du auf dem Host selbst testest.

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh \
  | ALFHEIM_VERSION=v0.3.0-rc.1 bash -s -- --non-interactive \
    --domain alfheim.localhost --admin-email admin@example.com --tls internal
```

---

## 1. Neuinstallation

| Prüfung | Erwartet |
| --- | --- |
| Exit-Code des Installers und `scripts/verify-stack.sh` | 0, jeder Dienst gesund |
| Zitadel `GET /admin/v1/policies/login` | `allowRegister` fehlt oder ist `false`; `/ui/login/register` antwortet „Registration is not allowed“ |
| Projektrolle `alfheim_operator` | existiert, dem Admin zugewiesen, `projectRoleAssertion: true` |
| Access-Token des Admins | enthält `alfheim_operator` unter `urn:zitadel:iam:org:project:roles` |
| Grafana-Anmeldung | Admin erhält die Org-Rolle Admin; ein Benutzer ohne die Rolle wird abgewiesen |
| `GET /api/v1/telemetry/logs` | echte Container-Logs für den Admin, `403 operator_required` für andere |
| `GET /api/v1/chat/mcp-servers/diagnostics`, `PATCH /api/v1/chat/mcp-servers/{id}` | 200 für den Admin, 403 für andere (die Liste selbst sehen sie gekürzt) |
| Budget-Beleg: Upload-URL, danach `PUT` aus dem Browser | URL unter `https://<app-host>/storage/`, `PUT` antwortet 200 |
| Chat-Anhang hochladen | 201, das Objekt liegt in RustFS |

Prüfe die Zeilen für „andere“ mit einem zweiten Benutzer, dem ein eigener
Haushalt gehört: Haushaltsrollen dürfen keine installationsweiten Ressourcen
freischalten.

---

## 2. Beispieldaten und Backup

Lege pro App mindestens einen Datensatz an (Budget-Konto und Buchung,
Pantry-Produkt mit Barcode, Einkaufsliste, Aufgabenvorlage, Wartungsgerät,
Bibliothekseintrag, Workout-Ausrüstung) und notiere sie. Dann:

```bash
alfheim-setup backup
```

Das Archiv muss `database.sql`, `rustfs-data.tar`, `.env`, den
Zitadel-Machinekey, die CA und die Caddy-PKI, die Stack-Dateien und
`manifest.json` enthalten.

---

## 3. Update

Setze ein zweites Pre-Release (oder nimm dasselbe noch einmal) und führe aus:

```bash
alfheim-setup update --version v0.3.0-rc.2
```

Erwartet: Bevor sich irgendetwas ändert, wird ein Backup geschrieben, die
Caddyfile wird neu erzeugt, das Zitadel-Provisioning läuft, jeder Dienst startet
gesund neu und die abschließende Prüfung besteht. Alle Beispieldaten sind
unverändert.

---

## 4. Löschen und wiederherstellen

```bash
docker compose -f compose.prod.yaml down -v
```

Lösche das Installationsverzeichnis, kopiere nur `alfheim-setup` und das Archiv
in ein leeres Verzeichnis und führe `alfheim-setup restore <archiv> --yes` aus.
Erwartet: Die Prüfung besteht, alle Beispieldatensätze und Objekte sind wieder
da, und beide Benutzer melden sich mit ihrem aktuellen Passwort an. Grafana
lässt den Admin weiterhin ein.

---

## 5. Upgrade vom vorherigen Release

Installiere den vorherigen stabilen Tag (`ALFHEIM_VERSION=<vorheriger>`), lege
damit Beispieldaten an und führe dann `alfheim-setup update --version <kandidat>`
aus. Erwartet:

- jede Datenbank eines Python-Dienstes wird gestempelt und auf ihren
  Alembic-Head gebracht (siehe [Schema-Migrationen](../explanation/schema-migrations.md));
  in Pantry ersetzen `uq_products_home_barcode` und `uq_products_global_barcode`
  den globalen eindeutigen Index `ix_products_barcode`;
- eine Wartungsdatenbank, die noch die Tabellen aus der Zeit vor den UUIDs hat,
  behält sie samt Zeilen im Schema `legacy_maintenance`;
- Reparaturen an der `.env` werden gemeldet (`minio` → `rustfs`,
  `DOCKER_SOCKET_GID`);
- die Registrierung wird abgeschaltet und `alfheim_operator` wird auf der
  bestehenden Installation angelegt und zugewiesen;
- alle mit dem vorherigen Release angelegten Daten sind noch da und
  beschreibbar.
