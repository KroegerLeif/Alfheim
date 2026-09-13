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
- [`scripts/zitadel-bootstrap.sh` — OIDC-Client-Bereitstellung](#scriptszitadel-bootstrapsh--oidc-client-bereitstellung)
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
curl -fsSL .../install.sh | bash -s -- --non-interactive --domain example.com --tls internal
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

Stage 1 startet `postgres-core → zitadel → rustfs → caddy` und führt dann [`scripts/zitadel-bootstrap.sh`](#scriptszitadel-bootstrapsh--oidc-client-bereitstellung) aus, damit Grafana bis zum Beginn der Beobachtungsstufe einen OIDC-Client hat. Es erfordert eine `.env`-Datei; erstellen Sie eine mit `./scripts/init-env.sh --auto`.

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

## `scripts/zitadel-bootstrap.sh` — OIDC-Client-Bereitstellung

Reconciliert das `Alfheim`-Projekt und die `Grafana`-OIDC-Anwendung in Zitadel, schreibt dann `GRAFANA_OIDC_CLIENT_ID` und `GRAFANA_OIDC_CLIENT_SECRET` in die Root-`.env`, wo sie von `infrastructure/telemetry/compose.yml` gelesen werden. `scripts/up.sh` ruft sie auf; direkte Ausführung ist nur zum Reparieren oder Rotieren von Anmeldedaten erforderlich.

Zitadel hat keine Admin-CLI, daher treibt das Skript die Management API an. Es authentifiziert sich mit dem persönlichen Zugriffstoken, das Zitadel beim Erstellen seiner ersten Instanz in `infrastructure/zitadel/machinekey/pat.txt` schreibt (`ZITADEL_FIRSTINSTANCE_PATPATH`). Eine Zitadel-Client-ID wird generiert, nicht gewählt, und ein Client-Secret wird genau einmal zurückgegeben, daher ist `.env` — nicht Zitadel — die Quelle der Wahrheit für das Secret; ein fehlender oder nicht übereinstimmender Wert wird durch Neugenerierung repariert.

### Syntax
```bash
./scripts/zitadel-bootstrap.sh [--force]
```

### Optionen & Flags
| Flag | Beschreibung |
| :--- | :--- |
| `--force` | Grafana-Client-Secret neu generieren, auch wenn `.env` bereits ein gültiges enthält |

> Das PAT wird nur geschrieben, während die *erste* Instanz erstellt wird. Wenn die Zitadel-Datenbank überlebt, aber die Datei weg ist, setzen Sie den lokalen IAM-Zustand mit `./scripts/down.sh --volumes` zurück und starten Sie erneut.

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
