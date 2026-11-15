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
alfheim-setup update|backup|restore|apps|zitadel-token ...
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
| `--tls STRATEGY` | `ALFHEIM_TLS_STRATEGY` | `hetzner`, `cloudflare`, `desec`, `custom` oder `internal`. **Erforderlich** im nicht-interaktiven Modus. |
| `--api-token TOKEN` | `ALFHEIM_DNS_API_TOKEN`, `HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `DESEC_TOKEN` | DNS-Provider-Token. Erforderlich für `hetzner`, `cloudflare` und `desec`. |
| `--cert-path DIR` | `ALFHEIM_CERT_PATH` | Absolutes Verzeichnis mit `fullchain.pem` und `privkey.pem`. Nur für `--tls custom`; weglassen zum Standard `./data/caddy/certs/` nutzen. |
| `--image-tag TAG` | `ALFHEIM_IMAGE_TAG` | Container-Image-Tag. Standard `latest`. |
| `--apps LISTE` | `ALFHEIM_APPS` | Zu aktivierende optionale Apps: `all`, `none` oder eine kommagetrennte Liste wie `pantry,shopping,telemetry`. Standard bei einer Neuinstallation: `none` (der [Lean Core](../../en/explanation/decisions/0007-lean-core-app-set.md), englisch); ein erneuter Lauf behält das gespeicherte `ALFHEIM_ENABLED_APPS`. Unbekannte Namen und verletzte Abhängigkeiten sind Nutzungsfehler. Ohne das Flag fragt der interaktive Assistent, Telemetrie als eigene Frage mit Standard „aus". `--apps=all` installiert wie bisher alles. |
| `--db-data-path DIR` | `ALFHEIM_DB_DATA_PATH` | Absolutes Host-Verzeichnis für die PostgreSQL-Daten. Standard: das benannte Volume `postgres_core_data`. |
| `--object-data-path DIR` | `ALFHEIM_OBJECT_DATA_PATH` | Absolutes Host-Verzeichnis für den RustFS-Objektspeicher. Standard: das benannte Volume `rustfs_data`. |
| `--metrics-data-path DIR` | `ALFHEIM_METRICS_DATA_PATH` | Absolutes Host-Verzeichnis für VictoriaMetrics. Standard: das benannte Volume `victoriametrics_data`. |
| `--logs-data-path DIR` | `ALFHEIM_LOGS_DATA_PATH` | Absolutes Host-Verzeichnis für VictoriaLogs. Standard: das benannte Volume `victorialogs_data`. |
| `--google-client-id ID` | `ALFHEIM_GOOGLE_CLIENT_ID` | „Sign in with Google" mit dieser OAuth-Client-ID einschalten. Braucht `ALFHEIM_GOOGLE_CLIENT_SECRET`. Ein erneuter Lauf behält die Werte aus der `.env`; ohne das Flag bietet der Assistent einen Schritt „external sign-in" an, der standardmäßig übersprungen wird. Siehe [Set up social login](../../en/how-to/social-login.md) (englisch). |
| — | `ALFHEIM_GOOGLE_CLIENT_SECRET` | Google-OAuth-Client-Secret. Nur über die Umgebung: Ein Flag würde es in der Prozessliste zeigen. |
| `--apple-client-id ID` | `ALFHEIM_APPLE_CLIENT_ID` | „Sign in with Apple" mit dieser Services ID einschalten. Braucht alle vier Apple-Werte. |
| `--apple-team-id ID` | `ALFHEIM_APPLE_TEAM_ID` | Team ID des Apple-Entwicklerkontos (10 Zeichen). |
| `--apple-key-id ID` | `ALFHEIM_APPLE_KEY_ID` | Key ID des Sign-in-with-Apple-Schlüssels (10 Zeichen). |
| `--apple-private-key-file PFAD` | `ALFHEIM_APPLE_PRIVATE_KEY_FILE` | Absoluter Pfad des `.p8`-Schlüssels. Die Datei muss Modus `0600` oder strenger haben, sonst bricht der Installer ab, bevor ein Container startet. In der `.env` wird nur der Pfad gespeichert. |
| `--smtp-host HOST` | `ALFHEIM_SMTP_HOST` | SMTP-Server für die E-Mails von Zitadel (Passwort-Zurücksetzung, Einladungen, Verifizierung). Ohne das Flag bietet der Assistent einen Schritt „e-mail (SMTP)" an; ein erneuter Lauf behält die Werte aus der `.env`. Leer lässt E-Mail aus. Siehe [E-Mail einrichten (SMTP)](../how-to/configure-smtp.md). |
| `--smtp-port PORT` | `ALFHEIM_SMTP_PORT` | SMTP-Port. Standard `587`. |
| `--smtp-user USER` | `ALFHEIM_SMTP_USER` | SMTP-Benutzer; leer für ein Relay ohne Authentifizierung. Braucht `ALFHEIM_SMTP_PASSWORD`. |
| — | `ALFHEIM_SMTP_PASSWORD` | SMTP-Passwort. Nur über Umgebung oder `.env`: Ein Flag würde es in der Prozessliste zeigen. |
| `--smtp-sender-address ADR` | `ALFHEIM_SMTP_SENDER_ADDRESS` | Absenderadresse jeder E-Mail. Mit einem Host erforderlich. |
| `--smtp-sender-name NAME` | `ALFHEIM_SMTP_SENDER_NAME` | Absendername. Standard `Alfheim`. |
| `--smtp-tls BOOL` | `ALFHEIM_SMTP_TLS` | `true` (Standard) nutzt implizites TLS oder STARTTLS; `false` nur für ein Relay auf demselben Host. |
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
| `desec` | Let's Encrypt Wildcard via DNS-01 | Nicht erforderlich | Benötigt einen deSEC API-Token. Siehe [deSEC DNS-01](../how-to/desec-dns-tls.md). |
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
| Keine `.alfheim.installed` | **install** | Vollständiger Assistent, mehrstufiger Boot. Eine `.env` aus einem abgebrochenen Lauf wird wiederverwendet, ihre Secrets bleiben erhalten. Bei einer DNS-01-Strategie wird zuerst der Token geprüft, und Zitadel wird erst eingerichtet, wenn Caddy gültige Zertifikate ausliefert. |
| `.alfheim.installed` vorhanden | **update** | Pull-Images und Neustart. Kein Assistent. Bestehende Secrets werden nie geändert; ein Secret, das ein neueres Release braucht und in der `.env` fehlt, wird erzeugt und angehängt. Fehlende Dienst-Datenbanken legt ein erneuter Lauf von `init-multiple-dbs.sh` an. |
| `.alfheim.installed` vorhanden, plus `--reconfigure` | **reconfigure** | Assistent läuft erneut; bestehende Secrets werden beibehalten. So wird auch die Domain gewechselt: [Domain wechseln](../how-to/change-domain.md). |

> **Warum Secrets niemals rotiert werden.** Die Neugenerierung von `ZITADEL_MASTERKEY` auf einer konfigurierten Instanz macht ihre Datenbank permanent unlesbar. Jeder bereits in `.env` vorhandene Wert wird weitergeleitet; nur tatsächlich fehlende werden generiert.

---

## Das `update`-Subkommando

```
alfheim-setup update [--version vX.Y.Z] [--install-dir DIR] [--yes]
```

Der Day-2-Befehl für jedes Release nach der Erstinstallation: Er lädt die
Standalone-Stack-Dateien eines Ziel-Releases (`compose.prod.yaml` u. a.)
herunter, sichert die vorherigen, setzt `IMAGE_TAG` in der `.env` und führt
anschließend dieselben Schritte aus wie ein einfacher erneuter Lauf (Secrets
auffüllen, Zitadel abgleichen, neu starten). Er benötigt eine bestehende
Installation (eine vorhandene `.env`) und startet nie den Assistenten,
rotiert nie ein Secret und rührt weder die Root-CA noch ein Docker-Volume an.
Wie jeder Provisioning-Lauf rotiert er den Zitadel-Maschinenschlüssel und
widerruft und leert bei einer Installation, die noch ein Bootstrap-PAT hat,
dieses PAT (siehe [Zitadel-Zugangsdaten](#zitadel-zugangsdaten)). Vollständige
Anleitung, Einzeiler und Rollback:
[Eine Installation aktualisieren](../how-to/update-installation.md).

`update` erstellt zuerst ein Backup von Datenbanken und Secrets (siehe unten)
und bricht ab, wenn das fehlschlägt. Mit `--skip-backup` wird ohne Backup
aktualisiert.

---

## Das `apps`-Subkommando

```
alfheim-setup apps list              [--install-dir DIR]
alfheim-setup apps enable  <name>    [--install-dir DIR]
alfheim-setup apps disable <name>    [--install-dir DIR]
```

Listet die Apps des [Lean-Core-App-Sets](../../en/explanation/decisions/0007-lean-core-app-set.md)
(englisch) auf und schaltet optionale Apps (und `telemetry`) auf einer
bestehenden Installation ein und aus. Die Auswahl steht als
`ALFHEIM_ENABLED_APPS` in der `.env`; eine `.env` ohne diesen Wert gilt als
„jede App aktiviert".

| Aktion | Verhalten |
| :--- | :--- |
| `list` | Gibt jede App mit ihrer Stufe (`core` oder `optional`), ihrem Zustand und ihren Abhängigkeiten aus. |
| `enable <name>` | Trägt die App in `ALFHEIM_ENABLED_APPS` und `COMPOSE_PROFILES` ein (und schreibt `CHAT_MCP_SERVERS` und `PANTRY_BACKEND_URL` passend zur neuen Auswahl um), legt eine fehlende Datenbank an (erneuter Lauf des idempotenten Postgres-Init-Skripts), lädt und startet ihre Container und wartet, bis sie gesund sind. Danach routet sie die App im Caddyfile und startet Caddy neu. Eine bereits aktive App zu aktivieren, bewirkt nichts. |
| `disable <name>` | Speichert die Änderung, stoppt und entfernt dann die Container der App (`docker compose rm -s -f`). **Volumes und Datenbanken werden nie entfernt**, ein erneutes Aktivieren bringt die Daten also zurück. Ihre Routen antworten danach mit 404 oder leiten zum Dashboard um ([Ingress-Matrix](../../en/reference/ingress-matrix.md#routes-of-disabled-apps), englisch). Eine bereits deaktivierte App zu deaktivieren, bewirkt nichts. |

Das Ein- oder Ausschalten von `telemetry` setzt zusätzlich `OTEL_ENABLED` in
der `.env`. Jeder andere Compose-Aufruf des Installers (Installation, einfacher
erneuter Lauf, `update`, `restore`) übergibt dieselben `COMPOSE_PROFILES`, daher
startet keiner davon eine deaktivierte App. Unbekannte Namen, Kern-Apps
(`disable dashboard`) und verletzte Abhängigkeiten (`enable shopping` ohne
`pantry`, `disable pantry` bei aktivem `shopping`) werden mit Exit-Code `1` und
einer Fehlermeldung abgelehnt, die den Konflikt nennt. `apps` erstellt die
Dashboard- und Chat-Backends nicht neu, die `ALFHEIM_ENABLED_APPS` und
`CHAT_MCP_SERVERS` beim Anlegen ihrer Container lesen; das übernimmt das nächste
`update`. Die Namen für `--apps` und den Speicherbedarf pro App listet der
[Anwendungskatalog](./apps-catalog.md). Anleitung:
[Manage apps](../../en/how-to/manage-apps.md) (englisch).

---

## Das `backup`-Subkommando

```
alfheim-setup backup [--output DIR] [--keep N] [--skip-media] [--install-dir DIR]
```

Schreibt ein Archiv `alfheim-backup-<UTC>.tar.gz` (Modus `0600`) mit einem
`pg_dumpall` aller Datenbanken, dem RustFS-Objektspeicher, `.env`, dem
Zitadel-Machinekey-Verzeichnis und dem Provisioner-Schlüssel, Root-CA und Caddy-PKI, den Stack-Dateien und einem
`manifest.json` mit Prüfsummen. Der Stack muss laufen. `--output` (oder
`ALFHEIM_BACKUP_DIR`) ist standardmäßig `<install-dir>/backups`; `--keep`
behält die N neuesten Archive (Standard 7); `--skip-media` lässt den
Objektspeicher weg. Das Archiv enthält alle Secrets im Klartext. Details,
Zeitplan und Off-Site-Kopien:
[Backup, Wiederherstellung & Datenmigration](../how-to/backup-restore.md).

## Das `restore`-Subkommando

```
alfheim-setup restore <Archiv> [--install-dir DIR] [--yes]
```

Prüft das Archiv gegen sein Manifest, ersetzt dann `.env` und die übrigen
Secrets, löscht und erstellt alle Datenbanken und Rollen aus dem Dump neu,
befüllt den RustFS-Speicher neu, startet den Stack und führt
`scripts/verify-stack.sh` aus. Ohne `--yes` wird nachgefragt. Zielsystem der
Wahl ist ein frischer Host. Siehe
[Backup, Wiederherstellung & Datenmigration](../how-to/backup-restore.md).

---

## Das `zitadel-token`-Subkommando

```
alfheim-setup zitadel-token --env-file PFAD [--zitadel-url URL] [--zitadel-tls-addr HOST:PORT] [--ca-file PFAD]
```

Gibt ein Access-Token des Provisioning-Maschinenbenutzers auf stdout aus, für manuelle Aufrufe der Zitadel-APIs. Es tauscht dafür den gespeicherten Maschinenschlüssel neben der `.env` ein und rotiert ihn nicht. Das Token trägt IAM-Owner-Rechte und läuft nach der Access-Token-Lebensdauer von Zitadel ab (standardmäßig 12 Stunden); bewahre es in einer Shell-Variablen auf, nie in einer Datei. Die Verbindungs-Flags funktionieren wie bei `provision`. Es schlägt fehl, solange noch kein Maschinenschlüssel existiert; dann zuerst `provision` oder `update` ausführen.

```bash
TOKEN=$(alfheim-setup zitadel-token --env-file /opt/alfheim/.env)
```

---

## Mehrstufiger Bootstrap

| Phase | Services | Wartet auf |
| :--- | :--- | :--- |
| 1 — Edge & Identität | `postgres-core`, `caddy`, `zitadel` | `alfheim_postgres_core` (120 s), `alfheim_caddy` (90 s), `alfheim_zitadel` (300 s) |
| 2 — Zitadel-Provisionierung | — | Gleicht das Projekt `Alfheim`, den Web-Client und, bei `OTEL_ENABLED=true`, den Grafana-Client über die Management API ab und schreibt ihre IDs in die `.env`; schaltet die Selbstregistrierung aus und gleicht die konfigurierten Social-Login-Provider und den SMTP-E-Mail-Provider ab |
| 3 — Kern & Anwendungs-Stack | alle übrigen Dienste des Lean Core und der aktivierten Apps (`COMPOSE_PROFILES`) | `dashboard-backend` (240 s), `dashboard-frontend` (180 s) |

Beim Provisioning legt der Installer das Zitadel-Projekt „Alfheim" und einen Client an, den sich das Dashboard und jedes App-Frontend teilen. Den Grafana-Client legt er nur bei eingeschalteter Telemetrie an (`OTEL_ENABLED=true` in der `.env`; eine Neuinstallation startet mit ausgeschalteter Telemetrie). Die Client-IDs schreibt er in die `.env`.

### Zitadel-Zugangsdaten

Das Provisioning meldet sich als Zitadel-Maschinenbenutzer `ZITADEL_BOOTSTRAP_USERNAME` mit einem Access-Token an, das innerhalb weniger Stunden abläuft (Access-Token-Lebensdauer von Zitadel, standardmäßig 12 Stunden). Das Token stammt aus einem Maschinenschlüssel in `infrastructure/zitadel/provisioner/machine-key.json` (Modus `0600`, Verzeichnis `0700`):

| Lauf | Verwendete Zugangsdaten | Danach vorhanden |
| :--- | :--- | :--- |
| Neuinstallation | Das PAT, das Zitadel nach `infrastructure/zitadel/machinekey/pat.txt` geschrieben hat (Ablauf `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE`) | Ein 90 Tage gültiger Maschinenschlüssel. Jedes PAT des Maschinenbenutzers ist widerrufen, `pat.txt` ist gelöscht. |
| Update oder erneuter Lauf einer älteren Installation | `ZITADEL_BOOTSTRAP_PAT` aus der `.env` | Wie oben, zusätzlich ist `ZITADEL_BOOTSTRAP_PAT` geleert. |
| Jeder weitere Lauf | Der gespeicherte Maschinenschlüssel | Ein neuer, 90 Tage gültiger Maschinenschlüssel; der vorherige ist in Zitadel gelöscht. |
| Gespeicherter Schlüssel abgelehnt (abgelaufen, andere Installation) | Ein PAT aus `pat.txt`, `ZITADEL_BOOTSTRAP_PAT` oder `--pat-file` | Wie bei einer Neuinstallation, plus eine Warnung. |

Schlägt das Löschen eines alten Schlüssels oder PATs fehl, ist das eine Warnung, kein Fehler: Der neue Schlüssel ist bereits gespeichert, und der nächste Lauf versucht es erneut. Ein `update` oder erneuter Lauf setzt außerdem `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE` eine Woche nach vorn, wenn das Datum fehlt oder schon vergangen ist, denn Zitadel lehnt ein abgelaufenes Datum ab, wenn es nach einer gelöschten Datenbank seine erste Instanz neu anlegt. Warum dieses Design und was der gespeicherte Schlüssel darf: [Wie sich der Installer bei Zitadel anmeldet](../explanation/authentication-security.md#wie-sich-der-installer-bei-zitadel-anmeldet).

### Social Login

Sind `ALFHEIM_GOOGLE_CLIENT_ID` und `ALFHEIM_GOOGLE_CLIENT_SECRET` gesetzt, legt das Provisioning den Instanz-Identity-Provider „Google" an oder aktualisiert ihn (mit den vier `ALFHEIM_APPLE_*`-Werten auch „Apple", wobei der aus `ALFHEIM_APPLE_PRIVATE_KEY_FILE` gelesene Schlüssel hochgeladen wird), mit den Optionen aus [ADR 0008](../../en/explanation/decisions/0008-social-login-policy.md) (englisch). Es trägt ihn in die Login-Policy ein, schaltet `allowExternalIdp` ein und lässt `allowRegister` aus. Es gibt die beim Provider zu registrierende Redirect-URI aus (die von Apple endet auf `/callback/form`, weil Apple mit einem Formular-POST antwortet) und schreibt `ZITADEL_<PROVIDER>_IDP_FINGERPRINT` in die `.env`. Ein Lauf ohne Änderungen schreibt nichts nach Zitadel. Werden beide Werte geleert, verschwindet der Provider von der Login-Seite, bleibt aber bestehen, damit vorhandene Benutzerverknüpfungen erhalten bleiben. Das versteckte Subkommando `provision` nimmt ebenfalls `--google-client-id ID` und die vier `--apple-*`-Flags an (das Google-Secret aus `ALFHEIM_GOOGLE_CLIENT_SECRET` in der Umgebung oder der `.env`) und schreibt die Werte in die `.env`. Eine zu offene Apple-Schlüsseldatei bricht auf jeder Installation mit einem Fehler ab, ob neu oder bestehend. Auf einer bestehenden Installation ist ein Social-Login-Fehler eine Warnung, sodass der Lauf trotzdem abschließt.

### E-Mail (SMTP)

Das Provisioning gleicht über die Admin API von Zitadel (`/admin/v1/email`) genau einen SMTP-E-Mail-Provider ab, der dem Installer gehört (Beschreibung „Alfheim installer (alfheim-setup)"). Ist `ALFHEIM_SMTP_HOST` gesetzt, legt es den Provider an oder aktualisiert ihn, aktiviert ihn und schreibt `ZITADEL_SMTP_FINGERPRINT` in die `.env`, einen Hash, der auch ein geändertes Passwort erkennt; ein Lauf ohne Änderungen schreibt nichts nach Zitadel. Schaltet es E-Mail ein, zeigt es außerdem **Forgot password** auf der Login-Seite (`hidePasswordReset=false`). Bei leerem Host löscht es seinen Provider und setzt `hidePasswordReset=true` in der Login-Policy der Instanz (und einer eigenen Policy der Organisation), damit kein Ablauf auf eine E-Mail wartet; die Selbstregistrierung bleibt in jedem Fall aus. Einen in der Zitadel-Konsole angelegten Provider ändert es nie, und solange einer aktiv ist, bleibt der Link zur Passwort-Zurücksetzung unangetastet. Die Ausgabe nennt, was passiert ist, und die Installationszusammenfassung weist darauf hin, dass Passwort-Zurücksetzung, Einladungen und E-Mail-Verifizierung nicht funktionieren, wenn SMTP übersprungen wurde. Das versteckte Subkommando `provision` nimmt dieselben `--smtp-*`-Flags an (Passwort aus `ALFHEIM_SMTP_PASSWORD` in der Umgebung oder der `.env`) und schreibt die Werte in die `.env`. Auf einer bestehenden Installation ist ein SMTP-Fehler eine Warnung, sodass der Lauf trotzdem abschließt.

### Telemetrie-Schalter

Das versteckte Subkommando `provision` nimmt `--telemetry` (oder `--telemetry=false`) an, um den optionalen Observability-Stack ein- oder auszuschalten. Wie `apps enable|disable telemetry` fügt es das Modul `telemetry` zu `ALFHEIM_ENABLED_APPS` hinzu oder entfernt es und schreibt `COMPOSE_PROFILES` und `OTEL_ENABLED` passend. Bei eingeschalteter Telemetrie legt es den Grafana-Client an; beim Ausschalten bleiben die vorhandenen Grafana-Zugangsdaten für ein späteres Wiedereinschalten erhalten. Ohne das Flag entscheidet `OTEL_ENABLED` aus der `.env`. Übernommen wird die Änderung mit `alfheim-setup update`, das das Caddyfile neu rendert (`/grafana` leitet bei eingeschalteter Telemetrie an Grafana weiter und sonst zum Dashboard um) und die Dienste neu erstellt. Siehe [Grafana-Zugriff](../how-to/grafana-access.md). Am Ende gibt der Installer den Anmeldenamen des Administrators und das generierte Passwort aus; beim ersten Login ist ein Passwortwechsel Pflicht.

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
| `.env` | `0600` | Alle Konfiguration und Zugangsdaten. Nach dem ersten Provisioning-Lauf kein Zitadel-Token. |
| `infrastructure/zitadel/provisioner/machine-key.json` | `0600` (Verzeichnis `0700`) | Maschinenschlüssel des Zitadel-Provisioning-Benutzers, bei jedem Provisioning-Lauf rotiert. Siehe [Zitadel-Zugangsdaten](#zitadel-zugangsdaten). |
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

Headless-Installation des Lean Core mit Pantry und Shopping, später die Budget-App ergänzen:

```bash
alfheim-setup --non-interactive --domain example.com --tls internal \
  --admin-email ops@example.com --apps pantry,shopping
alfheim-setup apps enable budget
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
* [Anleitung: Eine Installation aktualisieren](../how-to/update-installation.md)
* [Anleitung: E-Mail einrichten (SMTP)](../how-to/configure-smtp.md)
* [Umgebungsvariablen](./environment-variables.md)
* [CLI-Skripte](./cli-scripts.md)
* [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md)
