---
title: "CLI-Orchestrierungs-Skripte Referenz"
description: "Technische Referenz für Repository-Shell-Skripte für mehrstufiges Cluster-Booting, Umgebungsbereitstellung, Datenbank-Seeding und Workspace-Überprüfung."
sidebar:
  label: "CLI-Skripte"
---

> **Kurzfassung:** Technische Referenz für Repository-Shell-Skripte für mehrstufiges Cluster-Booting, Umgebungsbereitstellung, Datenbank-Seeding und Workspace-Überprüfung.

---

## 📋 Inhaltsverzeichnis
- [`install.sh` — Standalone-Installer-Bootstrap](#installsh--standalone-installer-bootstrap)
- [`scripts/up.sh` — Mehrstufiger Cluster-Boot-Orchestrator](#scriptsupsh--mehrstufiger-cluster-boot-orchestrator)
- [`scripts/down.sh` — Cluster-Teardown-Dienstprogramm](#scriptsdownsh--cluster-teardown-dienstprogramm)
- [`alfheim-setup provision` — OIDC-Client-Bereitstellung](#alfheim-setup-provision--oidc-client-bereitstellung)
- [`scripts/init-env.sh` — Kryptographischer Umgebungsgenerator](#scriptsinit-envsh--kryptographischer-umgebungsgenerator)
- [`scripts/verify.sh` — Monorepo-Qualitäts-Gating-Suite](#scriptsverifysh--monorepo-qualitäts-gating-suite)
- [`scripts/seed.sh` — Datenbank-Seed-Dienstprogramm](#scriptsseedsh--datenbank-seed-dienstprogramm)

---

## `install.sh` — Standalone-Installer-Bootstrap

Root-level-Bootstrap für eine neue Installation. Erkennt die Host-Architektur, lädt die entsprechende `alfheim-setup`-Release-Binärdatei herunter, verifiziert ihre SHA-256-Prüfsumme und übergibt die Kontrolle an den interaktiven Assistenten.

### Syntax
```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Argumente werden an die Binärdatei weitergeleitet:

```bash
curl -fsSL .../install.sh | bash -s -- --non-interactive --domain example.com --tls internal --admin-email du@example.com
```

### Umgebungsvariablen
| Variable | Beschreibung |
| :--- | :--- |
| `ALFHEIM_VERSION` | Release-Tag zum Installieren (Standard: `latest`) |
| `ALFHEIM_CHANNEL` | `stable` (Standard) oder `prerelease`. Pre-Releases werden niemals automatisch installiert. |
| `ALFHEIM_REPO` | Quell-Repository (Standard: `KroegerLeif/Alfheim`) |

> **Komplette Flag-Referenz:** [`docs/reference/installer-cli.md`](./installer-cli.md).
> **Design-Rationale:** [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md).

---

## `scripts/up.sh` — Mehrstufiger Cluster-Boot-Orchestrator

Orchestriert den Plattformstart in geordneten Abhängigkeitsstufen, um Race Conditions zu verhindern. Nutzt deterministische Health-Check-Warteschleife (`wait_healthy`).

### Syntax
```bash
./scripts/up.sh [OPTIONS]
```

### Optionen & Flags
| Flag | Beschreibung |
| :--- | :--- |
| `-b`, `--build` | Docker-Image vor dem Start der Container neu erstellen |
| `--skip-obs` | VictoriaStack-Beobachtungsstufe überspringen |
| `--lean` | Nur den Lean Core starten: Infrastruktur, Dashboard und Household, keine optionale App und keine Telemetrie |
| `--apps=LISTE` | Den Lean Core plus die kommagetrennten Module in `LISTE` starten, zum Beispiel `--apps=pantry,shopping,telemetry`. Telemetrie startet nur, wenn sie aufgeführt ist. Unbekannte Namen und `shopping` ohne `pantry` werden abgelehnt |
| `-h`, `--help` | Verwendungszusammenfassung ausgeben |

Ohne `--lean` oder `--apps` starten wie bisher alle Apps und der
Observability-Stack. Mit einem der beiden Flags exportiert `up.sh`
`COMPOSE_PROFILES` für seine Compose-Aufrufe und überspringt die Stufe jeder
abgeschalteten App. Pro App wird eine Stufe aus dem Array `OPTIONAL_APPS` im
Skript abgeleitet. Die Aufteilung in Lean Core und optionale Module ist in
[ADR 0007](../../en/explanation/decisions/0007-lean-core-app-set.md) (englisch)
festgehalten.

`./scripts/verify-stack.sh` prüft die Routen der Kern-Apps immer und die Route
einer optionalen App (oder `/grafana`) nur, wenn ihr Container läuft; es listet
die übersprungenen Routen auf und besteht daher auch nach `./scripts/up.sh --lean`.
In einem Repository-Checkout, in dem `compose.yaml` und `compose.prod.yaml` beide
liegen, prüft es `compose.yaml`, wenn nur der Dev-Stack läuft, sonst
`compose.prod.yaml`; `--compose-file` übersteuert die Wahl.

Setzt die `.env` `ALFHEIM_SMTP_HOST=mailpit` (siehe
[E-Mail einrichten](../how-to/configure-smtp.md#lokal-mit-mailpit-testen)),
startet Stufe 1 zusätzlich Mailpit, das Provisioning aktiviert es als
SMTP-Server von Zitadel, und `verify-stack.sh` prüft, dass eine E-Mail zur
Passwort-Zurücksetzung ankommt.

| Variable | Wirkung auf `verify-stack.sh` |
| :--- | :--- |
| `VERIFY_STACK_WAIT_SECONDS` | Wie lange auf Dienste gewartet wird, die noch in ihrer Healthcheck-Startphase sind (Standard `300`) |
| `VERIFY_STACK_INSECURE` | `1` überspringt die Prüfung des TLS-Zertifikats |
| `VERIFY_STACK_MAILPIT_URL` | Die HTTP-API von Mailpit. Setzen, um die Prüfung der Passwort-Zurücksetzung gegen ein Mailpit laufen zu lassen, das `ALFHEIM_SMTP_HOST` nicht nennt (Standard `http://127.0.0.1:8025`, wenn der Host `mailpit` ist) |
| `VERIFY_STACK_ZITADEL_TOKEN` | Zitadel-API-Token für diese Prüfung. Standard: `alfheim-setup zitadel-token` oder die Installer-Quellen in einem Repository-Checkout |

Stufe 1 startet `postgres-core → zitadel → rustfs → caddy` und stellt dann das Zitadel-Projekt und jeden OIDC-Client (Dashboard, jedes App-Frontend, Grafana) über `go run ./tools/installer/cmd/alfheim-setup provision` bereit, das sich die Abgleichslogik mit dem Produktiv-Installer teilt (`tools/installer/internal/features/provisioning`). Es erfordert eine `.env`; erzeuge sie mit `./scripts/init-env.sh --auto`.

---

## `scripts/down.sh` — Cluster-Teardown-Dienstprogramm

Stoppt und entfernt Docker-Container ordnungsgemäß in allen Workspace-Compose-Dateien.

### Syntax
```bash
./scripts/down.sh [OPTIONS]
```

### Optionen & Flags
| Flag | Beschreibung |
| :--- | :--- |
| `-v`, `--volumes` | Die benannten Docker-Volumes, die externen Netzwerke und das `postgres-core`-Datenverzeichnis `infrastructure/postgres/data` löschen (setzt Datenbankzustände zurück) |

`postgres-core` speichert seine Daten im Bind-Mount `infrastructure/postgres/data`,
den `docker compose down --volumes` nicht anfasst. Mit `-v` löscht `down.sh` ihn,
sobald die Container gestoppt sind, aus einem kurzlebigen Container des in
`infrastructure/compose.yml` gepinnten `postgres-core`-Images
(`--entrypoint rm`), weil die Dateien unter Linux dem postgres-Benutzer des
Containers gehören und ein `rm` auf dem Host Root bräuchte. Es verweigert die
Löschung und endet mit einem Fehlercode, wenn der Pfad auf etwas anderes als
`<Repository-Root>/infrastructure/postgres/data` zeigt (etwa über einen
Symlink). Ein mit `ALFHEIM_DB_DATA_PATH` gesetztes Datenverzeichnis wird nie
gelöscht. Ohne `-v` bleibt das Verzeichnis unverändert.

---

## `alfheim-setup provision` — OIDC-Client-Bereitstellung

Reconciliert das `Alfheim`-Projekt und jede von der Anwendung benötigte OIDC-Anwendung (ein öffentlicher PKCE-Client, geteilt vom Dashboard und jedem App-Frontend; ein vertraulicher Client für Grafana) in Zitadel, schreibt dann die generierten IDs und Secrets (`ZITADEL_PROJECT_ID`, `OIDC_AUDIENCE`, `ALFHEIM_WEB_CLIENT_ID`, `GRAFANA_OIDC_CLIENT_ID`, `GRAFANA_OIDC_CLIENT_SECRET`) in die Root-`.env`. `scripts/up.sh` ruft es auf; direkte Ausführung ist nur zum Reparieren oder Rotieren von Anmeldedaten erforderlich. Es ist ein verstecktes Subkommando des Installer-Binaries (`tools/installer/internal/app/provision_cmd.go`) und teilt sich die Reconciliation-Logik mit einer Produktivinstallation (`tools/installer/internal/features/provisioning`) statt eines separaten Shell-Skripts.

Zitadel hat keine Admin-CLI, daher steuert dieses Kommando die Management API über Caddy. Es meldet sich mit einem kurzlebigen Access-Token aus dem Maschinenschlüssel in `infrastructure/zitadel/provisioner/machine-key.json` neben der `.env` an und rotiert diesen Schlüssel bei jedem Lauf. Nur solange noch kein Schlüssel funktioniert, braucht es `--pat-file`: das persönliche Zugriffstoken, das Zitadel beim Anlegen seiner ersten Instanz nach `/machinekey/pat.txt` schreibt (`ZITADEL_FIRSTINSTANCE_PATPATH`). Dieser Lauf speichert den Schlüssel und widerruft jedes PAT des Maschinenbenutzers, das PAT funktioniert also genau einmal. Im Entwicklungs-Stack liegt das PAT im Docker-Volume `zitadel_machinekey`; `scripts/up.sh` kopiert es mit `docker compose cp` in eine private temporäre Datei und übergibt `--pat-file` nur, wenn es eines gefunden hat. Siehe [Zitadel-Zugangsdaten](installer-cli.md#zitadel-zugangsdaten). Eine Zitadel-Client-ID wird generiert, nicht gewählt, und ein Client-Secret wird genau einmal zurückgegeben, daher ist die `.env` — nicht Zitadel — die Quelle der Wahrheit für das Secret; ein fehlender oder abweichender Wert wird durch Neugenerierung repariert.

### Syntax
```bash
# Mit gespeichertem Maschinenschlüssel (jeder Lauf nach dem ersten)
go run ./tools/installer/cmd/alfheim-setup provision \
  --env-file .env \
  --zitadel-url http://127.0.0.1:80

# Erster Lauf oder Wiederherstellung nach abgelaufenem Schlüssel
docker compose cp zitadel:/machinekey/pat.txt ./pat.txt   # Entwicklungs-Stack
go run ./tools/installer/cmd/alfheim-setup provision \
  --env-file .env \
  --pat-file ./pat.txt \
  --zitadel-url http://127.0.0.1:80
rm ./pat.txt
```

### Optionen & Flags
| Flag | Beschreibung |
| :--- | :--- |
| `--env-file` | Die zu lesende und an Ort und Stelle zu aktualisierende `.env` |
| `--pat-file` | Ein persönliches Zugriffstoken des Provisioning-Maschinenbenutzers. Optional: nur nötig, solange noch kein funktionierender Maschinenschlüssel gespeichert ist (erster Lauf oder Wiederherstellung). Der Lauf widerruft es. |
| `--zitadel-url` | Caddys HTTP-Listener, nur genutzt, wenn `ZITADEL_EXTERNALSECURE` nicht `true` ist (Standard `http://127.0.0.1:80`) |
| `--zitadel-tls-addr` | Caddys HTTPS-Listener für eine sichere Installation; Anfragen nennen `https://<ZITADEL_EXTERNALDOMAIN>`, werden aber immer hierhin verbunden (Standard `127.0.0.1:443`) |
| `--ca-file` | Root-CA, der zusätzlich zu den System-Roots vertraut wird (Standard `infrastructure/ca/alfheim-root-ca.crt` neben der `.env`, falls vorhanden) |

> Die PAT-Datei wird nur beim Anlegen der *ersten* Instanz geschrieben, und der
> erste Provisioning-Lauf widerruft sie. Ist der Maschinenschlüssel verloren oder
> abgelaufen, in der Zitadel-Konsole ein kurzlebiges PAT für den Maschinenbenutzer
> erstellen und mit `--pat-file` übergeben, oder den lokalen IAM-Zustand wie unter
> [Erste Schritte](../tutorials/local-getting-started.md) beschrieben zurücksetzen
> und neu starten.

---

## `scripts/init-env.sh` — Kryptographischer Umgebungsgenerator

Generiert kryptographisch sichere Secrets (AES-256-Chat-Verschlüsselungsschlüssel, Zitadel-Masterkey und Admin-Passwort, Datenbankberechtigungen) und füllt `.env` auf.

Existiert die `.env` bereits (und ist `--force` nicht angegeben), migriert das Skript veraltete Schlüssel und ersetzt jeden Secret-artigen Schlüssel (`*PASSWORD*`, `*SECRET*`, `*TOKEN*`, `ZITADEL_MASTERKEY`), der noch seinem Platzhalter aus `.env.example` entspricht. Von dir geänderte Werte bleiben erhalten, gespiegelte Schlüssel (`S3_SECRET_KEY`, `ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD`) folgen ihrer Quelle, und ausgegeben werden nur Schlüsselnamen. Ein zweiter Lauf ändert nichts. Schlüssel mit leerem, `${...}`- oder `__PROVISIONED__`-Beispielwert sowie `CHAT_ENCRYPTION_KEY_ID` bleiben unangetastet. `scripts/tests/test-init-env.sh`, ausgeführt von `verify.sh --security`, prüft dieses Verhalten. Fehlt `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE`, ist es leer oder liegt es in der Vergangenheit, setzt das Skript es auf eine Woche ab jetzt; Zitadel lehnt ein abgelaufenes Datum ab, wenn es nach einer gelöschten Datenbank seine erste Instanz neu anlegt.

### Syntax
```bash
./scripts/init-env.sh [OPTIONS]
```

### Optionen & Flags
| Flag | Beschreibung |
| :--- | :--- |
| `--auto` | Nicht-interaktive Auto-Generierung mit Standard-Domain |
| `--base-url <url>` | Benutzerdefinierte Basis-Domain-URL setzen (z. B. `https://alfheim.loegien.de`) |
| `--force` | `.env` aus `.env.example` neu erzeugen, mit frischen Werten für jedes Secret |

---

## `scripts/verify.sh` — Monorepo-Qualitäts-Gating-Suite

Führt automatisierte Linting-, Formatierungs-, Typprüf- und Unit-Test-Suites in Python-, Go- und TypeScript-Workspace-Paketen aus.

### Syntax
```bash
./scripts/verify.sh [FLAGS]
```

### Optionen & Flags
| Flag | Beschreibung |
| :--- | :--- |
| `--python` | Führt Ruff-Check/Format, `uv run ty check` und `pytest` in Python-Backends aus |
| `--go` | Führt `go vet`, `gofmt` und `go test -race -cover ./...` in Go-Backends aus |
| `--frontend` | Führt `pnpm check-types` (`tsc --noEmit`) und Vitest in Frontends aus |
| `--security` | Führt gitleaks, die Prüfungen auf private Schlüssel, `.env` und `TODO` sowie die nicht verändernden pre-commit-Hooks aus; schlägt fehl, wenn gitleaks nicht installiert ist |
| `--allow-missing-gitleaks` | Mit `--security`: warnen statt fehlschlagen, wenn gitleaks nicht installiert ist |

---

## `scripts/seed.sh` — Datenbank-Seed-Dienstprogramm

Füllt relationale Datenbanken mit initialen Test-Haushalten, Benutzern, Speisekammer-Artikel, Einkaufslisten, Aufgaben und Trainingsvorlagen.

### Syntax
```bash
./scripts/seed.sh
```
