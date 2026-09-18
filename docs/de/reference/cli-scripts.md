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
| `-h`, `--help` | Verwendungszusammenfassung drucken |

Stage 1 startet `postgres-core → zitadel → rustfs → caddy` und stellt dann das Zitadel-Projekt und jeden OIDC-Client (Dashboard, jedes App-Frontend, Grafana) über `go run ./tools/installer/cmd/alfheim-setup provision` bereit, das sich die Reconciliation-Logik mit dem Produktiv-Installer teilt (`tools/installer/internal/features/provisioning`). Es erfordert eine `.env`-Datei; erstellen Sie eine mit `./scripts/init-env.sh --auto`.

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
| `-v`, `--volumes` | Persistente Docker-Volumes löschen (setzt Datenbankzustände zurück) |

---

## `alfheim-setup provision` — OIDC-Client-Bereitstellung

Reconciliert das `Alfheim`-Projekt und jede von der Anwendung benötigte OIDC-Anwendung (ein öffentlicher PKCE-Client, geteilt vom Dashboard und jedem App-Frontend; ein vertraulicher Client für Grafana) in Zitadel, schreibt dann die generierten IDs und Secrets (`ZITADEL_PROJECT_ID`, `OIDC_AUDIENCE`, `ALFHEIM_WEB_CLIENT_ID`, `GRAFANA_OIDC_CLIENT_ID`, `GRAFANA_OIDC_CLIENT_SECRET`) in die Root-`.env`. `scripts/up.sh` ruft es auf; direkte Ausführung ist nur zum Reparieren oder Rotieren von Anmeldedaten erforderlich. Es ist ein verstecktes Subkommando des Installer-Binaries (`tools/installer/internal/app/provision_cmd.go`) und teilt sich die Reconciliation-Logik mit einer Produktivinstallation (`tools/installer/internal/features/provisioning`) statt eines separaten Shell-Skripts.

Zitadel hat keine Admin-CLI, daher treibt dieses Kommando die Management API über Caddy an. Es authentifiziert sich mit dem persönlichen Zugriffstoken, das Zitadel beim Erstellen seiner ersten Instanz in `/machinekey/pat.txt` schreibt (`ZITADEL_FIRSTINSTANCE_PATPATH`). Im Entwicklungs-Stack liegt dieser Pfad im Docker-Volume `zitadel_machinekey`; `scripts/up.sh` kopiert die Datei mit `docker compose cp` in eine private temporäre Datei und speichert das PAT zusätzlich in `.env` (`ZITADEL_BOOTSTRAP_PAT`), damit ein späterer Lauf gegen eine bereits initialisierte Zitadel-Instanz es auch dann noch findet, wenn das Volume fehlt. Eine Produktivinstallation behält den Bind-Mount des Installers unter `infrastructure/zitadel/machinekey/`. Eine Zitadel-Client-ID wird generiert, nicht gewählt, und ein Client-Secret wird genau einmal zurückgegeben, daher ist `.env` — nicht Zitadel — die Quelle der Wahrheit für das Secret; ein fehlender oder nicht übereinstimmender Wert wird durch Neugenerierung repariert.

### Syntax
```bash
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
| `--env-file` | Die zu lesende und aktualisierende `.env` |
| `--pat-file` | Die PAT-Datei des Zitadel-Bootstrap-Maschinenbenutzers |
| `--zitadel-url` | Caddys HTTP-Listener, nur genutzt, wenn `ZITADEL_EXTERNALSECURE` nicht `true` ist (Standard `http://127.0.0.1:80`) |
| `--zitadel-tls-addr` | Caddys HTTPS-Listener für eine sichere Installation; Anfragen nennen `https://<ZITADEL_EXTERNALDOMAIN>`, werden aber immer hierhin verbunden (Standard `127.0.0.1:443`) |
| `--ca-file` | Root-CA, der zusätzlich zu den System-Roots vertraut wird (Standard `infrastructure/ca/alfheim-root-ca.crt` neben der `.env`, falls vorhanden) |

> Die PAT-Datei wird nur geschrieben, während die *erste* Instanz erstellt wird. Wenn die Zitadel-Datenbank überlebt, aber die Datei weg ist, wird stattdessen `ZITADEL_BOOTSTRAP_PAT` aus `.env` verwendet; ist auch das nicht verfügbar, setzen Sie den lokalen IAM-Zustand mit `./scripts/down.sh --volumes` zurück und starten Sie erneut.

---

## `scripts/init-env.sh` — Kryptographischer Umgebungsgenerator

Generiert kryptographisch sichere Secrets (AES-256-Chat-Verschlüsselungsschlüssel, Zitadel-Masterkey und Admin-Passwort, Datenbankberechtigungen) und füllt `.env` auf.

### Syntax
```bash
./scripts/init-env.sh [OPTIONS]
```

### Optionen & Flags
| Flag | Beschreibung |
| :--- | :--- |
| `--auto` | Nicht-interaktive Auto-Generierung mit Standard-Domain |
| `--base-url <url>` | Benutzerdefinierte Basis-Domain-URL setzen (z.B. `https://alfheim.loegien.de`) |

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
| `--security` | Führt Security-Scanner aus (Bandit, Trivy) |

---

## `scripts/seed.sh` — Datenbank-Seed-Dienstprogramm

Füllt relationale Datenbanken mit initialen Test-Haushalten, Benutzern, Speisekammer-Artikel, Einkaufslisten, Aufgaben und Trainingsvorlagen.

### Syntax
```bash
./scripts/seed.sh
```
