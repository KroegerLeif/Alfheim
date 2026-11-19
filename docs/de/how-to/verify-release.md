---
title: "Ein Release Ende zu Ende prüfen"
description: "Checkliste, um einen Release-Kandidaten vor dem Wechsel von dev nach main auf einem wegwerfbaren, produktionsnahen Stack zu testen: Neuinstallation, Operator-Zugriff, Uploads, Backup, Update, Restore und das Upgrade vom vorherigen Release."
---

> **Kurzfassung:** Unit-Tests simulieren Docker und Zitadel nur. Bevor `dev` nach `main` geht, installierst du den Kandidaten mit `alfheim-setup` auf einem Wegwerf-Host, gehst die Prüfungen unten durch und führst danach Backup, Update, Löschen, Restore und das Upgrade vom vorherigen Tag aus. Jeder Schritt hat ein erwartetes Ergebnis. Jede Abweichung blockiert das Release.

---

## 📋 Inhaltsverzeichnis
- [Zuerst den Release-Dry-Run ausführen](#zuerst-den-release-dry-run-ausführen)
- [Signaturen und Attestierungen prüfen](#signaturen-und-attestierungen-prüfen)
- [Wegwerf-Host vorbereiten](#wegwerf-host-vorbereiten)
- [1. Neuinstallation](#1-neuinstallation)
- [2. Beispieldaten und Backup](#2-beispieldaten-und-backup)
- [3. Update](#3-update)
- [4. Löschen und wiederherstellen](#4-löschen-und-wiederherstellen)
- [5. Upgrade vom vorherigen Release](#5-upgrade-vom-vorherigen-release)

---

## Zuerst den Release-Dry-Run ausführen

Bevor du etwas taggst, läuft der Release-Workflow im Dry-Run-Modus auf dem
Branch, den du veröffentlichen willst. Der Release-Pull-Request von `dev` nach
`main` startet ihn automatisch, und jeder neue Push auf diesen PR bricht den
laufenden Dry-Run ab und startet einen frischen. Du kannst ihn auch von Hand auf
jedem Branch starten (dafür muss die Workflow-Datei schon auf `main` liegen):

```bash
gh workflow run release.yml --ref dev -f dry_run=true
gh run watch
```

Ein Dry-Run führt dieselben Qualitäts-Gates aus, baut jedes Image nativ für
`linux/amd64` (`ubuntu-24.04`) und `linux/arm64` (`ubuntu-24.04-arm`) und wendet
das Trivy-Gate an (behebbare CRITICAL- und HIGH-Funde lassen den Job
fehlschlagen) und erzeugt die SBOM jedes Images. Er überspringt die Tag-Ancestry-Prüfung und veröffentlicht
nichts: Es wird kein Image gepusht, kein Manifest und kein Tag angelegt, nichts
signiert oder attestiert, kein GitHub-Release erstellt und kein SARIF-Report an Code Scanning gesendet. Manuelle
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

## Signaturen und Attestierungen prüfen

Jeder Tag-Lauf (auch Release-Kandidaten) signiert und attestiert, was er
veröffentlicht: schlüssellos über Sigstore mit der GitHub-OIDC-Identität des
Release-Workflows. Nichts wird mit einem langlebigen Schlüssel signiert.
Releases vor `v0.5.0` tragen keine Signaturen.

| Artefakt | Signatur | Attestierungen |
| --- | --- | --- |
| Jedes Multi-Arch-Image (`ghcr.io/kroegerleif/alfheim/<name>:<tag>`) | cosign, auf dem Index und jedem Plattform-Manifest | SLSA-Build-Provenance auf dem Index, SPDX-SBOM auf jedem Plattform-Image |
| `SHA256SUMS` | cosign-Bundle `SHA256SUMS.sigstore.json` (Release-Asset) | – |
| Installer-Binaries und Stack-Dateien aus `SHA256SUMS` | über die signierte `SHA256SUMS` | SLSA-Build-Provenance |

Prüfe sie am Kandidaten vor der Installation unten. Du brauchst
[cosign](https://docs.sigstore.dev/cosign/system_config/installation/) und die
GitHub CLI.

```bash
TAG="v0.5.0-rc.1"
IMAGE="ghcr.io/kroegerleif/alfheim/caddy"
IDENTITY='^https://github\.com/KroegerLeif/Alfheim/\.github/workflows/release\.yml@refs/tags/v'
ISSUER="https://token.actions.githubusercontent.com"

# Image-Signatur, gebunden an release.yml auf einem v*-Tag
cosign verify "${IMAGE}:${TAG}" \
  --certificate-identity-regexp "${IDENTITY}" --certificate-oidc-issuer "${ISSUER}"

# Build-Provenance des Multi-Arch-Images
gh attestation verify "oci://${IMAGE}:${TAG}" --repo KroegerLeif/Alfheim \
  --signer-workflow KroegerLeif/Alfheim/.github/workflows/release.yml

# SBOM des amd64-Images (arm64 für die andere Plattform)
DIGEST=$(docker buildx imagetools inspect "${IMAGE}:${TAG}" --format '{{json .Manifest}}' \
  | jq -r '.manifests[] | select(.platform.architecture == "amd64") | .digest')
gh attestation verify "oci://${IMAGE}@${DIGEST}" --repo KroegerLeif/Alfheim \
  --predicate-type https://spdx.dev/Document/v2.3
```

Für die Installer-Assets lädst du `SHA256SUMS`, `SHA256SUMS.sigstore.json` und
das Binary von der Release-Seite herunter, dann:

```bash
cosign verify-blob SHA256SUMS --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp "${IDENTITY}" --certificate-oidc-issuer "${ISSUER}"
sha256sum --check --ignore-missing SHA256SUMS
gh attestation verify alfheim-setup_linux_amd64 --repo KroegerLeif/Alfheim
```

Jeder Befehl muss mit einer erfolgreichen Prüfung enden. Schlägt einer bei
einem Tag fehl, den der Workflow veröffentlicht hat, wurde das Release nicht
korrekt signiert oder attestiert: Gib es nicht frei.

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
| Zitadel-Anmeldung | Die Anmeldung aus dem Dashboard leitet auf `/ui/login/login` (Login V1) weiter, nicht auf `/ui/v2/login`; `GET /oauth/v2/keys` listet `RS256`-Schlüssel |
| Zitadel `GET /admin/v1/policies/login` | `allowRegister` fehlt oder ist `false`; `/ui/login/register` antwortet „Registration is not allowed“ |
| Projektrolle `alfheim_operator` | existiert, dem Admin zugewiesen, `projectRoleAssertion: true` |
| Access-Token des Admins | enthält `alfheim_operator` unter `urn:zitadel:iam:org:project:roles` |
| Grafana-Anmeldung | Admin erhält die Org-Rolle Admin; ein Benutzer ohne die Rolle wird abgewiesen |
| `GET /api/v1/telemetry/logs` | echte Container-Logs für den Admin, `403 operator_required` für andere |
| `GET /api/v1/chat/mcp-servers/diagnostics`, `PATCH /api/v1/chat/mcp-servers/{id}` | 200 für den Admin, 403 für andere (die Liste selbst sehen sie gekürzt) |
| Budget-Beleg: Handyfoto an eine Buchung anhängen | Der Browser sendet die Datei an `/api/v1/budget/transactions/receipt` (nie an `/storage/`); das gespeicherte Objekt ist ein kleines WebP |
| Chat-Anhang hochladen | 201, das Objekt liegt in RustFS |
| Zitadel-Zugangsdaten | `ZITADEL_BOOTSTRAP_PAT` in der `.env` ist leer, `infrastructure/zitadel/machinekey/pat.txt` ist gelöscht, `infrastructure/zitadel/provisioner/` hat Modus `0700` und `machine-key.json` Modus `0600`; `alfheim-setup zitadel-token --env-file .env` gibt ein Token aus |
| Passwort-Zurücksetzung per E-Mail (mit SMTP) | **Forgot password** wird auf der Login-Seite angezeigt, und die E-Mail kommt an. Gegen Mailpit prüft `scripts/verify-stack.sh` das mit `ALFHEIM_SMTP_HOST=mailpit` selbst ([E-Mail einrichten](./configure-smtp.md#lokal-mit-mailpit-testen)); ohne SMTP ist der Link ausgeblendet |

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
- das langlebige `ZITADEL_BOOTSTRAP_PAT` wird einmal verwendet, in Zitadel
  widerrufen und aus der `.env` entfernt; stattdessen wird ein
  Maschinenschlüssel gespeichert (Verzeichnis `0700`, Datei `0600`), und
  `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE` wird in der `.env` ergänzt;
- alle mit dem vorherigen Release angelegten Daten sind noch da und
  beschreibbar.

Ein Upgrade von v0.4.x oder älter hebt Zitadel außerdem von v2.66 auf v4.
Zusätzlich erwartet:

- Zitadel startet auf derselben Datenbank und mit demselben Masterkey und
  führt seine Setup-Migrationen selbst aus (`start-from-init` überspringt die
  Init-Schritte, die es bereits vorfindet);
- vor dem Update ausgestellte Tokens werden abgelehnt (401), weil v4 nur mit
  neuen Web Keys signiert; Benutzer melden sich neu an und behalten ihre
  Zitadel-Benutzer-ID, ihre Haushalte bleiben also unverändert;
- in den ersten Minuten nach dem Update kann `GET /oauth/v2/keys`
  `{"keys":null}` liefern und die Anmeldung mit `Errors.WebKey.NoActive`
  scheitern, während Zitadel seine Projektionen nachzieht; das erholt sich
  ohne Eingriff.
