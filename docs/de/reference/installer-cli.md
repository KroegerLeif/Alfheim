---
title: "alfheim-setup CLI Referenz"
description: "Komplette Parameter-Referenz für den Alfheim-Installer."
sidebar:
  label: "Installer CLI"
---

Komplette Parameter-Referenz für den Alfheim-Installer.

* **Binärdatei:** `alfheim-setup`
* **Quelle:** [`tools/installer`](../../../tools/installer)
* **Bootstrap:** [`install.sh`](../../../install.sh)
* **Design:** [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md)

---

## Zusammenfassung

```
alfheim-setup [flags]
```

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Argumente nach `--` werden an die Binärdatei weitergeleitet:

```bash
curl -fsSL .../install.sh | bash -s -- --non-interactive --domain example.com --tls internal
```

---

## Mode-Flags

| Flag | Beschreibung |
| :--- | :--- |
| `--dry-run` | Führe jede Validierung aus, generiere Secrets und rendere `.env` und die `Caddyfile` in ein temporäres Verzeichnis. Startet keine Container und modifiziert keine bestehende Installation. Ein Host ohne Docker erzeugt Warnungen statt eines Fehlers. |
| `--non-interactive` | Nehme jede Antwort aus Flags und Umgebungsvariablen statt des Assistenten. Zitadel wird automatisch bereitgestellt; der Anmeldename und das Passwort werden gedruckt. |
| `--reconfigure` | Führe den Assistenten über einer bestehenden Installation erneut aus. **Bestehende Secrets werden beibehalten, niemals rotiert.** |
| `--install-dir DIR` | Installations-Root-Verzeichnis. Standard: das aktuelle Arbeitsverzeichnis. |
| `--version` | Drucke Build-Metadaten und beende, vor jeder Host-Überprüfung. |

## Konfiguration-Flags

Jedes Flag hat ein Umgebungsvariablen-Äquivalent. Das Flag gewinnt, wenn beide gesetzt sind.

| Flag | Umgebungsvariable | Beschreibung |
| :--- | :--- | :--- |
| `--domain HOST` | `ALFHEIM_DOMAIN` | Basis-Domain, z.B. `example.com`. **Erforderlich** im nicht-interaktiven Modus. |
| `--app-host HOST` | `ALFHEIM_APP_HOST` | Host, der das Dashboard bedient. Standardmäßig die Basis-Domain. |
| `--admin-email MAIL` | `ALFHEIM_ADMIN_EMAIL` | Zitadel-Administrator-Anmeldename (verifiziert, keine E-Mail erforderlich) und ACME-Kontakt. **Erforderlich** im nicht-interaktiven Modus. |
| `--tls STRATEGY` | `ALFHEIM_TLS_STRATEGY` | `hetzner`, `cloudflare`, `custom` oder `internal`. **Erforderlich** im nicht-interaktiven Modus. |
| `--api-token TOKEN` | `ALFHEIM_DNS_API_TOKEN`, `HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN` | DNS-Provider-Token. Erforderlich für `hetzner` und `cloudflare`. |
| `--cert-path DIR` | `ALFHEIM_CERT_PATH` | Absolutes Verzeichnis mit `fullchain.pem` und `privkey.pem`. Nur für `--tls custom`; weglassen zum Standard `./data/caddy/certs/` nutzen. |
| `--image-tag TAG` | `ALFHEIM_IMAGE_TAG` | Container-Image-Tag. Standard `latest`. |
| — | `ALFHEIM_INSTALL_DIR` | Äquivalent zu `--install-dir`. |

### Release-Auswahl

`install.sh` liest drei weitere Variablen:

| Variable | Beschreibung |
| :--- | :--- |
| `ALFHEIM_VERSION` | Pinne einen exakten Release-Tag. Standard `latest`, welcher gegen den Channel unten aufgelöst wird. |
| `ALFHEIM_CHANNEL` | `stable` (Standard) oder `prerelease`. |
| `ALFHEIM_REPO` | Setzt das Quell-Repository außer Kraft. |

Auf dem `stable`-Channel löst der Installer den neuesten Release auf, der *nicht* als Pre-Release markiert ist. Tags mit `-rc`, `-beta` oder `-alpha` werden als Pre-Releases veröffentlicht, daher erreicht ein Testing-Build niemals einen Host, der keinen anforderte. Wenn kein stabiler Release existiert, stoppt der Installer und nennt den neuesten Pre-Release zusammen mit den zwei Befehlen, die ihn installieren würden.

Nutze `ALFHEIM_CHANNEL=prerelease`, um den neuesten Release jeglicher Art zu nehmen, oder `ALFHEIM_VERSION`, um einen exakt zu pinnen.

---

## TLS-Strategien

| Strategie | Zertifikate | Eingangsport 80 | Anmerkungen |
| :--- | :--- | :--- | :--- |
| `hetzner` | Let's Encrypt Wildcard via DNS-01 | Nicht erforderlich | Benötigt einen Hetzner DNS API-Token. |
| `cloudflare` | Let's Encrypt Wildcard via DNS-01 | Nicht erforderlich | Benötigt einen Cloudflare-Token mit `Zone:DNS:Edit`. |
| `custom` | Von dir bereitgestellt | Nicht erforderlich | Benötigt `fullchain.pem` und `privkey.pem`. |
| `internal` | Vom Installer erzeugte Root-CA (HTTPS) | Nicht erforderlich | Browser warnen, bis du `infrastructure/ca/alfheim-root-ca.crt` importierst (Fingerprint wird am Ende ausgegeben) oder die Warnung akzeptierst. Die Root wird einmal erzeugt und nie stillschweigend ersetzt. Installationen aus der Zeit, als hier noch HTTP galt, migrieren mit `--reconfigure`. |

Siehe [Hetzner DNS-01](../how-to/hetzner-dns-tls.md) und [Benutzerdefinierte Zertifikate](../how-to/custom-certificates.md).

### Der Root-CA von `internal` vertrauen

Browser speichern Zertifikatsausnahmen pro Host. Akzeptierst du die Warnung nur für den App-Host, wird die Hintergrundanfrage des Logins an den Auth-Host ohne Rückfrage abgelehnt, und die Anmeldung scheitert mit „Failed to fetch“.

**Empfohlen:** Importiere `infrastructure/ca/alfheim-root-ca.crt` einmal in den Zertifikatsspeicher des Betriebssystems oder Browsers. Das deckt jeden Alfheim-Host ab. Vergleiche vorher den SHA-256-Fingerprint mit dem, den der Installer ausgibt.

* **macOS:** Schlüsselbundverwaltung → Schlüsselbund *System* → Datei importieren, dann *Vertrauen* auf *Immer vertrauen* setzen.
* **Windows:** `certmgr.msc` → *Vertrauenswürdige Stammzertifizierungsstellen* → *Zertifikate* → *Alle Aufgaben* → *Importieren*.
* **Linux / Firefox:** Zertifikatseinstellungen des Browsers → *Zertifizierungsstellen* → *Importieren*. Firefox nutzt auf jedem Betriebssystem einen eigenen Speicher.

**Ohne Import:** Öffne vor der Anmeldung **beide** Adressen, `https://<App-Host>` und `https://<Auth-Host>` (der Installer gibt beide aus), und akzeptiere auf jeder die Zertifikatswarnung.

Schritte pro Gerät (auch Android und iOS) und die Prüfung des Fingerprints: [Der lokalen Root-CA vertrauen](../how-to/trust-local-root-ca.md).

---

## Betriebsmodi

Der Modus wird aus dem Installations-Verzeichnis erkannt, nicht durch ein Flag gewählt.

| Erkannter Zustand | Modus | Verhalten |
| :--- | :--- | :--- |
| Keine `.env`, keine `.alfheim.installed` | **install** | Volständiger Assistent, Secret-Generierung, mehrstufiger Boot. |
| Eines der beiden Files vorhanden | **update** | Pull-Images und Neustart. Kein Assistent, keine Secret-Änderungen. |
| Eines der Dateien vorhanden, plus `--reconfigure` | **reconfigure** | Assistent läuft erneut; bestehende Secrets werden beibehalten. |

> **Warum Secrets niemals rotiert werden.** Die Neugenerierung von `ZITADEL_MASTERKEY` auf einer konfigurierten Instanz macht ihre Datenbank permanent unlesbar. Jeder bereits in `.env` vorhandene Wert wird weitergeleitet; nur genuinely fehlende werden generiert.

---

## Mehrstufiger Bootstrap

| Phase | Services | Wartet auf |
| :--- | :--- | :--- |
| 1 — Edge & Identität | `postgres-core`, `caddy`, `zitadel` | `alfheim_postgres_core` (120 s), `alfheim_caddy` (90 s), `alfheim_zitadel` (300 s) |
| 2 — Zitadel-Provisionierung | — | Gleicht das Projekt `Alfheim`, den Web-Client und den Grafana-Client über die Management-API ab und schreibt ihre IDs in die `.env` |
| 3 — Kern & Anwendungs-Stack | alle verbleibenden | `dashboard-backend` (240 s), `dashboard-frontend` (180 s) |

Danach gibt der Installer den Anmeldenamen des Administrators (die eingegebene E-Mail) und das generierte Passwort aus; beim ersten Login ist ein Passwortwechsel Pflicht.

---

## Exit-Codes

| Code | Bedeutung |
| :--- | :--- |
| `0` | Erfolg. |
| `1` | Laufzeitfehler — Host nicht bereit, Validierung fehlgeschlagen, ein Container wurde nicht gesund. |
| `2` | Nutzungsfehler — unbekanntes Flag, versehentliches Argument, oder fehlende erforderliche Eingabe im nicht-interaktiven Modus. |
| `130` | Unterbrochen (SIGINT/SIGTERM). Bereits gestartete Container sind weiterhin aktiv. |

Bei Unterbrechung wird das Terminal wiederhergestellt und der Resume-Befehl wird gedruckt. Nichts wird abgerissen, da eine halb-fertige Zitadel-Initialisierung nicht zerstört werden darf.

---

## Generierte Dateien

| Pfad | Modus | Inhalte |
| :--- | :--- | :--- |
| `.env` | `0600` | Alle Konfiguration und Berechtigungen. |
| `infrastructure/caddy/Caddyfile` | `0644` | Gerenderete Ingress-Konfiguration. Enthält keine Berechtigung; DNS-Token sind als `{env.NAME}` referenziert. |
| `.alfheim.installed` | `0644` | Completion-Marker: Version und Timestamp. |
| `data/caddy/certs/` | `0700` | Erstellt für `--tls custom` im Standard-Speicherort. |

---

## Beispiele

Interaktive Installation im aktuellen Verzeichnis:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Alles anschauen ohne den Host zu berühren:

```bash
alfheim-setup --dry-run --non-interactive --domain example.com --tls internal
```

Headless-CI-Installation mit Cloudflare DNS-01:

```bash
ALFHEIM_DNS_API_TOKEN="$CF_TOKEN" alfheim-setup \
  --non-interactive \
  --domain example.com \
  --tls cloudflare \
  --admin-email ops@example.com \
  --install-dir /srv/alfheim
```

Domain auf einer laufenden Instanz ändern:

```bash
cd /srv/alfheim && alfheim-setup --reconfigure
```

Einen spezifischen Release pinnen:

```bash
ALFHEIM_VERSION=v0.2.0 bash -c "$(curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh)"
```

Neuesten Pre-Release zum Testen installieren:

```bash
ALFHEIM_CHANNEL=prerelease bash -c "$(curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh)"
```

---

## Siehe auch

* [Tutorial: Ihre erste Installation](../tutorials/first-run.md)
* [Umgebungsvariablen](./environment-variables.md)
* [CLI-Skripte](./cli-scripts.md)
* [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md)
