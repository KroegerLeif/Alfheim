---
title: "ADR 0004: Standalone Interactive Installer als typiertes Go-TUI"
description: "Technische Story: #353 Interactive Standalone Setup Installer (Go + Charm Huh?)"
sidebar:
  label: "0004 Go TUI Installer"
---

* Status: akzeptiert
* Deciders: Alfheim Core Maintainers
* Datum: 2026-09-12

Technische Story: [#353 Interactive Standalone Setup Installer (Go + Charm Huh?)](https://github.com/KroegerLeif/Alfheim/issues/353)

---

## Kontext und Problembeschreibung

Das Setup einer neuen Alfheim-Instanz auf einem Fresh Debian- oder Proxmox-Host erforderte einen Operator, `.env`-Dateien hand-zu-schreiben, Secrets manuell zu generieren und Caddy-Reverse-Proxy-Konfiguration hand-zu-editieren. Das bestehende `scripts/install.sh` automatisierte einen Teil davon, aber es war auf rough 500 Codezeilen Bash gewachsen, orchestrierte immer noch Keycloak nach [ADR 0003](./0003-migrate-from-keycloak-to-zitadel.md) es mit Zitadel ersetzte und war praktisch untestbar.

Drei Probleme verschärften dies:

1. **Keine Typ-Sicherheit oder Tests.** Secret-Generierung, TLS-Strategieauswahl und mehrstufiger Container-Boot waren alles untestbare String-Manipulation.
2. **Eine Bootstrap-Zyklus um Zitadel.** Anwendungs-Services können ein OIDC-Token nicht validieren, bis ein Administrator in Zitadel existiert, aber dieser Administrator kann nur über einen Browser erstellt werden, sobald Zitadel up ist und ein gültiges Zertifikat hält. Ein einzelner `docker compose up -d` kann diese Ordering nicht ausdrücken.
3. **Kein Zero-Clone-Pfad.** Installation erforderte Klonen des gesamten Monorepo auf den Server, obwohl nur eine Handvoll Dateien zur Runtime benötigt werden.

---

## Entscheidungs-Treiber

* Deterministische, testable Installations-Logik hinter >=80%-Koverages-Gate.
* Ein Single-Command-Bootstrap, der über `curl … | bash` auf einem nackten Host funktioniert.
* Explizites, auditable Handling von Secrets und TLS-Private-Keys.
* Ausrichtung mit den Feature-Driven Design Konventionen des Repository.
* Idempotence: Neuausführung des Installers darf eine funktionierend Instanz niemals zerstören.

---

## Betrachtete Optionen

* **Option 1: Erweitere den bestehenden Bash-Installer.**
* **Option 2: Ansible Playbook oder Cloud-Init.**
* **Option 3: Ein standalone Go CLI mit Charm `huh` TUI.**

---

## Entscheidungs-Ergebnis

Gewählte Option: **Option 3**, weil es die einzige Option ist, die die Installations-Logik Unit-testbar macht, während sie immer noch eine einzelne statische Binärdatei produziert, die auf einem nackten Host mit null Runtime-Dependencies läuft.

Der Installer lebt bei `tools/installer` als sein eigenes Go-Modul, registriert im Root `go.work` Workspace.

### Struktur

Feature-Slices unter `internal/features/` besitzen jedes einen Concern — `onboarding`, `security`, `tls`, `templating`, `bootstrap` — und gemeinsame Abstraktionen leben unter `internal/shared/`, passt zum Layout von bereits `core/dashboard/backend` verwendet.

> **Abweichung vom Problem.** Problem #353 schlug `internal/core/` vor. Wir nutzen `internal/shared/` stattdessen, weil das die etablierte Konvention in jedem bestehenden Alfheim-Go-Service ist, und ein zweiter Name für das gleiche Konzept wäre eine unnötige Inkonsistenz.

### Entkoppeltes Zitadel-Bootstrapping

Der Container-Boot ist in zwei explizite Phasen geteilt:

1. **Edge & Identität** — `postgres-core`, `caddy`, `zitadel`. Caddy erhält das Zertifikat für `auth.<domain>`, und der Assistent pausiert dann und fragt den Operator auf, den initial Administrator zu erstellen.
2. **Kern & Anwendungs-Stack** — alles andere, startete nur nach der Operator-Bestätigung.

Die Pause wird als injizierter `ConfirmFunc` modelliert, daher kann ein Headless-Run sie überspringen und Tests können das Phase 2 nie vor Bestätigung beginnt beurteilen.

### Mockbare Prozess-Ausführung

Jeder externe Befehl geht durch eine `runner.Runner`-Interface. `ExecRunner` ist Produktion, `RecordingRunner` beurteilt exakte Docker Compose-Sequenzen ohne Daemon, und `DryRunRunner` implementiert `--dry-run` als Decorator, daher leck keine bedingten Branches in den Orchestrator.

### Benutzerdefiniertes Caddy-Image

Das Upstream-`caddy:2-alpine`-Image schifft **keine ACME DNS Provider-Module**, daher können die Hetzner- und Cloudflare-DNS-01-Strategien nicht damit funktionieren. Caddy wird daher von `infrastructure/caddy/Dockerfile` mit `xcaddy` gebaut, inklusive `caddy-dns/hetzner` und `caddy-dns/cloudflare`. Der Build beurteilt, dass beide Module vorhanden sind, daher fällt ein unterbrochenes Image bei Build-Zeit statt bei Zertifikat-Erneuerungszeit aus.

DNS API-Token werden in `.env` geschrieben und von der Caddyfile als `{env.HETZNER_API_TOKEN}` referenziert. Die gerenderete Caddyfile enthält daher niemals ein Credential, welche ein Test erzwingt.

### Positive Konsequenzen

* Secret-Generierung, TLS-Path-Validierung, Templating und die Boot-Sequenz sind bei über 90%-Statement-Coverage von Unit-Tests abgedeckt.
* Golden-File-Tests pinnen die gerenderete `.env` und `Caddyfile` für alle vier TLS-Strategien, und die gerendereten Caddyfiles werden gegen einen echten Caddy-Binary validiert.
* `--dry-run` rendert eine komplette Konfiguration in ein temporäres Verzeichnis ohne eine bestehende Installation zu berühren oder einen Container zu starten.
* Eine einzelne statische Binärdatei pro Architektur, gerufen und Checksum-verifiziert durch Root `install.sh`.
* Neuausführung soll Tag-2-Update standardisieren; Secrets werden nur immer für eine genuinely neue Installation neu generiert.

### Negative Konsequenzen & Akzeptierte Kosten

* **Das Ingress-Gateway ist jetzt ein benutzerdefiniertes Image, das wir bauen und publish müssen.** Dies fügt einen Job zur Release-Pipeline hinzu und macht uns verantwortlich für das Tracking von Upstream-Caddy-Releases.
* **Go ist jetzt erforderlich, um den Installer zu modifizieren**, erhöhend die Barriere für eine schnelle Fix verglichen zum Editieren von Bash.
* **Das TUI braucht ein echtes Terminal.** `install.sh` reattaches stdin zu `/dev/tty`, daher funktioniert `curl … | bash` immer noch; ohne das würde der Assistent sofort austreten.
* Ein zweiter Installer-Pfad existierte bis `scripts/install.sh` entfernt wurde; Root `install.sh` ist jetzt der einzige unterstützte Einstiegspunkt.

---

## Pros und Cons der Optionen

### Option 1: Erweitere den bestehenden Bash-Installer

* Gut, weil es keine neue Toolchain braucht und jeder Maintainer es lesen kann.
* Gut, weil es bereits in die Release-Artefakte verdrahtet ist.
* Schlecht, weil Secret-Generierung und TLS-Branching untestbar bleiben, daher kann die 80%-Coverage-Gate nicht erreicht werden.
* Schlecht, weil es bereits aus Sync mit ADR 0003 drifted war, während es immer noch der dokumentierte Installations-Pfad war.
