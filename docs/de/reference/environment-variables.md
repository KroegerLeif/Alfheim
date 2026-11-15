---
title: "Umgebungsvariablen Referenz"
description: "Erschöpfende Referenz der in der gesamten Alfheim-Infrastruktur, Kerndiensten und Microservice-Anwendungen verwendeten Umgebungsvariablen."
sidebar:
  label: "Umgebungsvariablen"
---

> **Kurzfassung:** Erschöpfende Referenz der in der gesamten Alfheim-Infrastruktur, Kerndiensten und Microservice-Anwendungen verwendeten Umgebungsvariablen.

---

## 📋 Inhaltsverzeichnis
- [Root-Plattformkonfiguration](#root-plattformkonfiguration)
- [Identität & Zugriffsverwaltung (Generisches OIDC & Zitadel)](#identität--zugriffsverwaltung-generisches-oidc--zitadel)
- [Social Login](#social-login)
- [E-Mail (SMTP)](#e-mail-smtp)
- [Objektspeicher (RustFS S3)](#objektspeicher-rustfs-s3)
- [Datenverzeichnisse](#datenverzeichnisse)
- [Beobachtungs-Stack (VictoriaStack & Telemetrie)](#beobachtungs-stack-victoriastack--telemetrie)
- [Microservice-Backend-Variablen](#microservice-backend-variablen)
- [Haushalts- & Rollendienst (`core/household`)](#haushalts---rollendienst-corehousehold)
- [Frontend-Umgebungsvariablen](#frontend-umgebungsvariablen)
- [ACME & TLS-Konfiguration](#acme--tls-konfiguration)
- [PostgreSQL-Datenbankberechtigungen](#postgresql-datenbankberechtigungen)

---

## Root-Plattformkonfiguration

Zentral konfiguriert in Root `.env` (generiert aus `.env.example` via `./scripts/init-env.sh`):

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `ALFHEIM_BASE_URL` | `https://alfheim.loegien.de` | Öffentliche Root-Domain für Frontend-Ingress |
| `ALFHEIM_HOST` | `alfheim.loegien.de` | Kanonischer Hostname für die Hauptanwendung |
| `DOMAIN` | `loegien.de` | Root-Domain für alle Dienste |
| `IMAGE_REGISTRY` | `ghcr.io` | Container-Image-Registry |
| `IMAGE_REPO` | `kroegerleif/alfheim` | Container-Image-Repository |
| `IMAGE_TAG` | _(erforderlich)_ | Container-Image-Tag. `compose.prod.yaml` startet ohne ihn nicht; der Installer schreibt ihn immer (Standard: die eigene Release-Version des Installers, `latest` bei einem Entwicklungs-Build) |
| `CADDY_TLS_DIRECTIVE` | _(leer)_ | Optional Caddy-TLS-Override (`tls internal` für lokal signiertes HTTPS; leer lassen für Auto-HTTPS) |
| `ALFHEIM_EXTRA_CA_FILE` | _(leer)_ | Pfad im Container zu einem PEM-Bundle zusätzlicher Root-CAs, denen serverseitige OIDC-Clients (Python-Backends, Go-Backends von Dashboard und Chat, Grafana über `GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_CA`) **zusätzlich** zu den System-Roots vertrauen. Der Installer setzt `/etc/alfheim/ca/alfheim-root-ca.crt` für die TLS-Strategie `internal` (Host-Verzeichnis `infrastructure/ca/`, schreibgeschützt eingebunden) und lässt ihn sonst leer. Eine unlesbare oder Nicht-PEM-Datei wird als Fehler mit dem Pfad gemeldet, nie stillschweigend ignoriert |

---

## Identität & Zugriffsverwaltung (Generisches OIDC & Zitadel)

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `OIDC_ISSUER_URL` | `https://auth.loegien.de` | Öffentlicher OIDC-Aussteller: die Basis-URL des IAM-Hosts |
| `OIDC_INTERNAL_URL` | `http://zitadel:8080` | Interne Basis-URL für Server-zu-Server-OIDC-Aufrufe (bleibt im Container-Netzwerk) |
| `OIDC_AUDIENCE` | `alfheim` | Ziel-OIDC-Client-ID / Audience für Backend-Token-Validierung |
| `ZITADEL_MASTERKEY` | *(Generierter 32-Byte-Schlüssel)* | Verschlüsselungs-Master-Key für Zitadel-Initialisierung (muss genau 32 Zeichen sein; generieren Sie mit `openssl rand -hex 16`) |
| `ZITADEL_EXTERNALDOMAIN` | `auth.loegien.de` | Öffentlicher Hostname für Zitadel-OIDC-Endpunkte |
| `ZITADEL_EXTERNALPORT` | `443` | Öffentlicher Port für Zitadel (typischerweise 443 für HTTPS oder 80 für HTTP) |
| `ZITADEL_EXTERNALSECURE` | `true` | Ob Zitadel via HTTPS zugänglich ist (auf `true` in Produktion setzen) |
| `ZITADEL_ADMIN_USER` | `admin` | Zitadel-Initial-Administrator-Benutzername |
| `ZITADEL_ADMIN_PASSWORD` | `Password1!` | Zitadel-Verwaltungsbenutzer-Passwort (neu generiert von `scripts/init-env.sh` für Produktion) |
| `ZITADEL_DB_HOST` | `postgres-core` | Zitadel-Datenbank-Host |
| `ZITADEL_DB_PORT` | `5432` | Zitadel-Datenbank-Port |
| `ZITADEL_DB_NAME` | `zitadel` | Zitadel-Datenbankname |
| `ZITADEL_DB_USER` | `zitadel_user` | Zitadel-Datenbankbenutzer |
| `ZITADEL_DB_PASSWORD` | `postgres` | Zitadel-Datenbankpasswort |
| `ZITADEL_BOOTSTRAP_USERNAME` | `alfheim-bootstrap` | Maschinenbenutzer, den Zitadel mit seiner ersten Instanz anlegt; `alfheim-setup` provisioniert als dieser Benutzer |
| `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE` | _(Zeitpunkt des Renderns + 7 Tage, UTC)_ | Ablauf des PATs, das Zitadel beim ersten Start für diesen Benutzer anlegt. Von `compose.prod.yaml` vorausgesetzt. `alfheim-setup update` und ein erneuter Lauf von `alfheim-setup` ergänzen es, wenn es fehlt, und schieben es eine Woche nach vorn, wenn es vergangen ist (eine gelöschte Datenbank bei behaltener `.env`), wie es auch `scripts/init-env.sh` tut. Wird ignoriert, sobald die Instanz existiert. |
| `ZITADEL_BOOTSTRAP_PAT` | _(leer)_ | Bleibt leer. Nur zur Wiederherstellung setzen, wenn der Maschinenschlüssel abgelaufen ist; der nächste Provisioning-Lauf verwendet es einmal, widerruft es in Zitadel und leert es. Siehe [Zitadel-Zugangsdaten](installer-cli.md#zitadel-zugangsdaten). |

Der Zitadel-Dienst in `compose.prod.yaml` und `infrastructure/compose.yml` setzt außerdem zwei Werte, die nicht aus der `.env` gelesen werden, weil der übrige Stack von ihnen abhängt. Beide wirken nur, wenn Zitadel seine Instanz anlegt:

| Variable | Wert | Beschreibung |
| :--- | :--- | :--- |
| `ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED` | `false` | Behält das eingebaute Login V1 unter `/ui/login`; Login V2 bräuchte einen separaten Container `zitadel-login` |
| `ZITADEL_DEFAULTINSTANCE_WEBKEYS_TYPE` | `rsa` | Signiert Tokens mit RSA-Web-Keys, passend zur `RS256`-Prüfung in jedem Backend |

---

## Social Login

Optional. Nur `alfheim-setup` liest sie (Installation, erneuter Lauf, `update`, `provision`) und richtet damit die Provider in Zitadel ein; kein Container liest sie. Leere Werte lassen einen Provider aus. Siehe [Set up social login](../../en/how-to/social-login.md) und [ADR 0008](../../en/explanation/decisions/0008-social-login-policy.md) (beide englisch).

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `ALFHEIM_GOOGLE_CLIENT_ID` | _(leer)_ | Google-OAuth-Client-ID. Zusammen mit dem Secret setzen, um „Sign in with Google" hinzuzufügen; Flag `--google-client-id`. |
| `ALFHEIM_GOOGLE_CLIENT_SECRET` | _(leer)_ | Google-OAuth-Client-Secret. Nur über Umgebung oder `.env` (kein Flag), wird nie ausgegeben. |
| `ZITADEL_GOOGLE_IDP_FINGERPRINT` | _(vom Provisioning geschrieben)_ | SHA-256 über die konfigurierten Google-Zugangsdaten, damit der nächste Lauf ein rotiertes Secret erkennt. Ein Hash, nicht das Secret. Nicht bearbeiten. |
| `ALFHEIM_APPLE_CLIENT_ID` | _(leer)_ | Apple Services ID. Alle vier Apple-Werte setzen, um „Sign in with Apple" hinzuzufügen; Flag `--apple-client-id`. |
| `ALFHEIM_APPLE_TEAM_ID` | _(leer)_ | Team ID des Apple-Entwicklerkontos (10 Zeichen); Flag `--apple-team-id`. |
| `ALFHEIM_APPLE_KEY_ID` | _(leer)_ | Key ID des Sign-in-with-Apple-Schlüssels (10 Zeichen); Flag `--apple-key-id`. |
| `ALFHEIM_APPLE_PRIVATE_KEY_FILE` | _(leer)_ | Absoluter Pfad der `.p8`-Schlüsseldatei, Modus `0600` oder strenger (der Installer lehnt alles Offenere ab). Gespeichert wird nur der Pfad; der Schlüssel wird nach Zitadel hochgeladen. Flag `--apple-private-key-file`. |
| `ZITADEL_APPLE_IDP_FINGERPRINT` | _(vom Provisioning geschrieben)_ | SHA-256 über die konfigurierten Apple-Werte einschließlich Schlüssel, damit ein ersetzter Schlüssel erkannt wird. Nicht bearbeiten. |

---

## E-Mail (SMTP)

Optional. Nur `alfheim-setup` liest sie (Installation, erneuter Lauf, `update`, `provision`) und richtet damit den SMTP-E-Mail-Provider von Zitadel ein; kein Container liest sie. Ein leerer Host lässt E-Mail aus: Passwort-Zurücksetzung, Einladungen und E-Mail-Verifizierung funktionieren dann nicht, und die Login-Seite blendet **Forgot password** aus. Siehe [E-Mail einrichten (SMTP)](../how-to/configure-smtp.md).

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `ALFHEIM_SMTP_HOST` | _(leer)_ | Hostname des SMTP-Servers, ohne Port oder Schema; Flag `--smtp-host`. Im lokalen Stack `mailpit`. |
| `ALFHEIM_SMTP_PORT` | `587`, sobald ein Host gesetzt ist | SMTP-Port; Flag `--smtp-port`. |
| `ALFHEIM_SMTP_USER` | _(leer)_ | SMTP-Benutzer; leer für ein Relay ohne Authentifizierung. Zusammen mit dem Passwort setzen; Flag `--smtp-user`. |
| `ALFHEIM_SMTP_PASSWORD` | _(leer)_ | SMTP-Passwort. Nur über Umgebung oder `.env` (kein Flag), wird nie ausgegeben. |
| `ALFHEIM_SMTP_SENDER_ADDRESS` | _(leer)_ | Absenderadresse jeder E-Mail, mit einem Host erforderlich; Flag `--smtp-sender-address`. |
| `ALFHEIM_SMTP_SENDER_NAME` | `Alfheim`, sobald ein Host gesetzt ist | Absendername; Flag `--smtp-sender-name`. |
| `ALFHEIM_SMTP_TLS` | `true`, sobald ein Host gesetzt ist | `true` nutzt implizites TLS oder STARTTLS; `false` nur für ein Relay auf demselben Host. Flag `--smtp-tls`. |
| `ZITADEL_SMTP_FINGERPRINT` | _(vom Provisioning geschrieben)_ | SHA-256 über die konfigurierten SMTP-Werte einschließlich Passwort, damit ein geändertes Passwort erkannt wird. Ein Hash, nicht das Passwort. Nicht bearbeiten. |

---

## Objektspeicher (RustFS S3)

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `S3_ENDPOINT_URL` | `http://rustfs:9000` | S3-kompatibler Objektspeicher-Endpunkt (verwendet von Python-Backends) |
| `S3_ENDPOINT` | `http://rustfs:9000` | S3-kompatibler Objektspeicher-Endpunkt (verwendet von Go-Chat-Backend) |
| `S3_PUBLIC_URL` | `https://alfheim.loegien.de/storage` | Öffentliches URL-Präfix für den Zugriff auf gespeicherte Objekte im Browser |
| `S3_BUCKET_NAME` | `budget-receipts` | Standard-Bucket für Budget-Quittungs-Uploads |
| `S3_ACCESS_KEY` | `minioadmin` | S3-Zugangsschlüssel-ID. RustFS kennt nur sein Root-Konto, daher muss der Wert `S3_ROOT_USER` entsprechen |
| `S3_SECRET_KEY` | `minioadmin` | S3-geheimer Zugangsschlüssel. Muss `S3_ROOT_PASSWORD` entsprechen (der Installer spiegelt beide) |
| `S3_ROOT_USER` | `minioadmin` | RustFS-Root-Benutzer (Initial-Admin) |
| `S3_ROOT_PASSWORD` | `minioadmin` | RustFS-Root-Passwort |
| `DOCKER_SOCKET_GID` | erkannt (in Produktion Pflicht) | Numerische Gruppen-ID, der `/var/run/docker.sock` auf dem Host gehört (`stat -c %g /var/run/docker.sock`); `alfheim-setup` erkennt sie bei der Installation und ergänzt sie beim Update, falls sie fehlt |

---

## Datenverzeichnisse

Standardmäßig liegt jede Datenklasse in einem benannten Docker-Volume. Setzt du eine dieser Variablen in `.env`, wird daraus ein Bind-Mount eines Host-Verzeichnisses, etwa um die Datenbank auf eine eigene Platte zu legen. Compose behandelt einen Wert ohne Schrägstrich als benanntes Volume und einen absoluten Pfad als Bind-Mount; nicht gesetzt oder leer behält also das bisherige Verhalten. `alfheim-setup` akzeptiert dieselben Namen als Flags (`--db-data-path`, `--object-data-path`, `--metrics-data-path`, `--logs-data-path`) und fragt sie im Assistenten ab. Es legt jedes Verzeichnis mit dem Besitzer an, den der Container braucht, prüft die Schreibbarkeit und warnt, wenn es auf demselben Dateisystem wie `/` liegt.

| Variable | Standard | Eingebunden unter | Benötigter Besitzer |
| :--- | :--- | :--- | :--- |
| `ALFHEIM_DB_DATA_PATH` | _(leer: Volume `postgres_core_data`)_ | PostgreSQL `/var/lib/postgresql/data` | `70:70`, Modus `0700` (alpine-Benutzer `postgres`) |
| `ALFHEIM_OBJECT_DATA_PATH` | _(leer: Volume `rustfs_data`)_ | RustFS `/data` | `10001:10001`, Modus `0700` |
| `ALFHEIM_METRICS_DATA_PATH` | _(leer: Volume `victoriametrics_data`)_ | VictoriaMetrics `/victoria-metrics-data` | `0:0` (das Image läuft als root) |
| `ALFHEIM_LOGS_DATA_PATH` | _(leer: Volume `victorialogs_data`)_ | VictoriaLogs `/victoria-logs-data` | `0:0` (das Image läuft als root) |

Hinweise:

- Pfade müssen absolut sein, dürfen kein `:` enthalten und müssen sich unterscheiden. Grafana und Caddy behalten ihre benannten Volumes.
- Ändere eine Variable auf einer laufenden Installation nicht allein in `.env`: Das neue Verzeichnis ist leer. Migriere mit `alfheim-setup backup`, stoppe den Stack, setze die Variable (oder starte `alfheim-setup --reconfigure` mit dem Flag) und führe dann `alfheim-setup restore` aus. Backup und Restore funktionieren für Volumes und Bind-Mounts gleich.
- PostgreSQL-18-Images legen die Daten in einem Versionsunterverzeichnis unterhalb von `/var/lib/postgresql` ab. Ändere beim Upgrade auf diese Hauptversion das Mount-Ziel zusammen mit dem Image; das hier konfigurierte Verzeichnis enthält dann `18/docker`.

---

## Beobachtungs-Stack (VictoriaStack & Telemetrie)

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4317` | OTLP-gRPC-Endpunkt für Metriken- und Trace-Export |
| `OTEL_EXPORTER_OTLP_INSECURE` | `true` | Unverschlüsselte OTLP-Verbindungen zulassen (auf `false` für TLS setzen) |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana-Initial-Admin-Benutzername |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana-Initial-Admin-Passwort |
| `GRAFANA_OIDC_CLIENT_ID` | `alfheim-grafana` | Zitadel-OIDC-Client-ID für Grafana-SSO |
| `GRAFANA_OIDC_CLIENT_SECRET` | _(auto-provisioned)_ | Zitadel-OIDC-Client-Secret für Grafana-SSO (gesetzt von `alfheim-setup provision` / dem Provisioning-Schritt des Installers) |

Der Grafana-SSO ist auf Nutzer mit der Zitadel-Projektrolle `alfheim_operator` beschränkt; alle anderen werden abgewiesen. Der lokale `admin`-Login funktioniert weiterhin. Siehe [Grafana-Zugriff gewähren](../how-to/grafana-access.md).

---

## Microservice-Backend-Variablen

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `{SERVICE}_DATABASE_URL` | _(konstruiert)_ | Explizite PostgreSQL-Verbindungszeichenkette für einen Dienst (z.B. `DASHBOARD_DATABASE_URL`, `PANTRY_DATABASE_URL`); wenn leer, konstruieren Dienste sie aus `{SERVICE}_POSTGRES_*`-Variablen |
| `TESTING` | _(nicht gesetzt)_ | Nur in Backend-Testsuites auf `true` setzen; umgeht die JWT-Prüfung. Niemals in einem deployten Stack setzen |
| `OTEL_ENABLED` | _(je Compose-Datei)_ | Aktiviert die OpenTelemetry-Erfassung in den FastAPI-Backends |
| `CHAT_ENCRYPTION_KEY` | _(leer)_ | AES-256-GCM-Schlüssel (Base64-codiert) zum Verschlüsseln gespeicherter LLM-API-Schlüssel und Anmeldedaten |
| `CHAT_ENCRYPTION_KEY_ID` | `v1` | Versions-ID für den Verschlüsselungsschlüssel (für Schlüsselrotation verwendet) |
| `CHAT_ATTACHMENT_URL_SECRET` | _(leer)_ | HMAC-Schlüssel (mindestens 32 Byte), der Download-URLs für Chat-Anhänge signiert. In Produktion erforderlich; wird vom Installer erzeugt |
| `CHAT_ATTACHMENT_URL_TTL_MINUTES` | `15` | Lebensdauer einer signierten Download-URL für Chat-Anhänge |
| `CHAT_MCP_SERVERS` | `pantry=http://pantry-backend:8000/mcp,chores=http://chores-backend:8000/mcp,maintenance=http://maintenance-backend:8000/mcp` | Kommagetrennte MCP-Server-Definitionen für den Chat-Assistenten |
| `CHAT_ALLOWED_LLM_HOSTS` | `host.docker.internal` | Kommagetrennte Hostnamen, IPs und CIDR-Bereiche, auf die Basis-URLs von Modellblöcken trotz privater Adresse zeigen dürfen (siehe unten) |
| `PANTRY_BACKEND_URL` | `http://pantry-backend:8000` | Interne URL für Shopping-List-Dienst zum Erreichen der Speisekammer-Inventar-API |
| `GOOGLE_BOOKS_API_KEY` | _(leer)_ | Google Books API-Schlüssel für Bibliotheks-Metadaten-Anreicherung (optional; leer lassen zum Deaktivieren) |
| `TMDB_API_KEY` | _(leer)_ | The Movie Database API-Schlüssel für Bibliotheks-Medien-Metadaten-Anreicherung (optional; leer lassen zum Deaktivieren) |
| `MAX_MANUAL_UPLOAD_BYTES` | `52428800` | Größter akzeptierter PDF-Upload für Bibliotheks-Anleitungen in Bytes (50 MiB); größere Uploads werden mit HTTP 413 abgelehnt |
| `MAX_RECEIPT_UPLOAD_BYTES` | `10485760` | Größter akzeptierter Budget-Beleg-Upload in Bytes (10 MiB); größere Uploads werden mit HTTP 413 abgelehnt |

### Chat: ausgehende Modell-Endpunkte

Basis-URLs von Modellblöcken sind Benutzereingaben. Das Chat-Backend verbindet sich daher nur mit `http`/`https`-URLs, deren Host ausschließlich auf öffentliche Adressen auflöst. Loopback, Link-Local (auch die Cloud-Metadaten-Adresse `169.254.169.254`), unspezifizierte, Multicast-, private (RFC 1918, `fc00::/7`), Carrier-Grade-NAT-Adressen (`100.64.0.0/10`) und ähnliche Bereiche werden beim Anlegen und Ändern eines Blocks, bei der Modellsuche und erneut beim Verbindungsaufbau abgelehnt (das verhindert DNS-Rebinding). Weiterleitungen werden nie verfolgt, Fehlerantworten der Gegenstelle werden nur serverseitig protokolliert.

`CHAT_ALLOWED_LLM_HOSTS` nennt die privaten Ziele, die du zulässt. Einträge sind Hostnamen (z. B. `host.docker.internal`), IP-Adressen oder CIDR-Bereiche (z. B. `192.168.1.0/24`), durch Kommas getrennt. Ohne Wert gilt `host.docker.internal`, sodass das dokumentierte Setup mit Ollama auf dem Docker-Host weiter funktioniert. Ein ungültiger Wert wird protokolliert und wie eine leere Liste behandelt (nichts Privates erlaubt).

**Migration:** Läuft Ollama auf einem anderen Rechner im LAN (z. B. `http://192.168.1.50:11434` oder `http://gpu-box.lan:11434`), funktionieren bestehende Modellblöcke dorthin erst wieder, wenn du den Host oder Bereich ergänzt, z. B. `CHAT_ALLOWED_LLM_HOSTS=host.docker.internal,192.168.1.50` oder `CHAT_ALLOWED_LLM_HOSTS=host.docker.internal,gpu-box.lan`, und das Chat-Backend neu startest. Die Variable ersetzt den Standardwert, `host.docker.internal` muss also in der Liste bleiben, falls du ihn weiter brauchst.

Bootstrap-Modellblöcke (aus `CHAT_BOOTSTRAP_*`) werden von der Server-Umgebung verwaltet und sind für alle API-Nutzer schreibgeschützt: Sie lassen sich weder bearbeiten noch löschen, aber jeder Nutzer kann sie auswählen und eine Statusprüfung auslösen. Die Bootstrap-URL unterliegt beim Verbindungsaufbau derselben Allowlist. Wer bei einem anderen Block die `base_url` ändert, muss einen neuen `api_key` angeben (oder `clear_api_key`), denn der gespeicherte Schlüssel wird nie an einen anderen Endpunkt gesendet.

---

## Haushalts- & Rollendienst (`core/household`)

Tier-1-Kerndienst, dem Haushalte und Mitgliederrollen gehören. `compose.prod.yaml` betreibt ihn als `household-backend` (Go, Port `8080`, Health-Check `GET /healthz`) und `household-frontend` (Next.js, Port `3000`, basePath `/household`). Das Frontend erhält dieselben Variablen wie `dashboard-frontend` (`NEXT_PUBLIC_OIDC_ISSUER`, `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID` aus `ALFHEIM_WEB_CLIENT_ID`, `ALFHEIM_BASE_URL`).

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `HOUSEHOLD_POSTGRES_USER` | `household_user` | Datenbankrolle des Household-Backends |
| `HOUSEHOLD_POSTGRES_PASSWORD` | `postgres` | Passwort von `household_user`. `alfheim-setup` erzeugt einen zufälligen Wert mit 32 Zeichen; ein einfaches Day-2-Update ergänzt ihn in einer älteren `.env`, ohne bestehende Secrets anzufassen |
| `HOUSEHOLD_POSTGRES_DB` | `alfheim_household` | Datenbank des Household-Backends, angelegt von `infrastructure/postgres/init-multiple-dbs.sh` |
| `HOUSEHOLD_DATABASE_URL` | _(konstruiert)_ | Optionale vollständige Verbindungszeichenkette; wenn leer, baut `compose.prod.yaml` `postgres://household_user:…@postgres-core:5432/alfheim_household?sslmode=disable` |
| `ALFHEIM_INTERNAL_TOKEN` | `change-me-internal-token` | Gemeinsames Secret für Service-zu-Service-Aufrufe an die `/internal/*`-API des Household-Backends. `alfheim-setup` erzeugt 32 Zufallsbytes (64 Hex-Zeichen) und erzeugt einen vorhandenen Wert nie neu. Caddy routet `/internal/*` nie (Antwort `404` auf beiden Hosts). `household-backend` prüft den Wert; alle sieben Python-App-Backends (pantry, shopping, chores, maintenance, budget, workout, library) und `chat-backend` erhalten ihn und senden ihn bei Mitgliedschaftsprüfungen als `Authorization: Bearer …`. `compose.prod.yaml` verlangt ihn; die Dev-Compose-Dateien fallen auf `dev-internal-token-change-me` zurück (`scripts/init-env.sh` erzeugt einen Zufallswert) |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL, die die App-Backends und `chat-backend` für `GET /internal/v1/memberships/{householdId}/{userSub}` verwenden. Aufgelöst über `gateway-net`, dem `household-backend` und jeder Konsument beitreten. Jeder Konsument wartet, bis `household-backend` healthy ist, bevor er startet |

---

## Frontend-Umgebungsvariablen

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://alfheim.loegien.de` | Browser-zugängliche Frontend-Root-URL |
| `NEXT_PUBLIC_OIDC_ISSUER` | `https://auth.loegien.de` | Browser-seitige OIDC-Aussteller für den PKCE-Autorisierungs-Code-Flow |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | `dashboard-frontend` | Zitadel-OIDC-Client-ID für das Dashboard-Frontend (andere Frontends können unterschiedliche IDs verwenden) |
| `NEXT_PUBLIC_OIDC_REDIRECT_URI` | `https://alfheim.loegien.de/` | OAuth2-Redirect-URI für das Dashboard-Frontend |
| `NEXT_PUBLIC_API_URL` | _(abgeleitet)_ | Browser-API-Basis-URL jedes Frontends. Nicht in der `.env` gesetzt: Compose leitet sie aus `ALFHEIM_BASE_URL` als Build-Argument und Laufzeit-Umgebung ab, mit der Same-Origin-Caddy-Route, die der Client der App erwartet (siehe unten). `scripts/init-env.sh` entfernt die alten Einträge `NEXT_PUBLIC_*_API_URL` pro App und `NEXT_PUBLIC_API_GATEWAY_URL` aus einer bestehenden `.env` |

Abgeleitete `NEXT_PUBLIC_API_URL` pro Frontend:

| Frontend | Wert |
| :--- | :--- |
| `dashboard-frontend`, `household-frontend` | `${ALFHEIM_BASE_URL}/api/v1` |
| `pantry-frontend` | `${ALFHEIM_BASE_URL}/pantry/api/v1` |
| `shopping-frontend` | `${ALFHEIM_BASE_URL}/shopping/api/v1` |
| `workout-frontend` | `${ALFHEIM_BASE_URL}/workout/api/v1` |
| `chores-frontend`, `budget-frontend`, `chat-frontend`, `maintenance-frontend`, `library-frontend` | `${ALFHEIM_BASE_URL}/api/v1/<app>` |

Im Entwicklungs-Stack liest `household-frontend` stattdessen `NEXT_PUBLIC_HOUSEHOLD_API_URL` (Standard `http://api.alfheim.loegien.localhost/api/v1`).

---

## ACME & TLS-Konfiguration

Automatische TLS-Zertifikat-Ausstellung via Let's Encrypt. Siehe `docs/en/how-to/hetzner-dns-tls.md` für Setup-Anleitung.

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `ACME_EMAIL` | _(leer)_ | E-Mail-Adresse für ACME-Zertifikat-Benachrichtigungen und Wiederherstellung; **erforderlich** für automatisches HTTPS |
| `HETZNER_API_TOKEN` | _(leer)_ | Hetzner DNS API-Token für DNS-01-Challenges (erforderlich wenn Hetzner DNS verwendet wird) |
| `CLOUDFLARE_API_TOKEN` | _(leer)_ | Cloudflare API-Token für DNS-01-Challenges (erforderlich wenn Cloudflare DNS verwendet wird) |
| `DESEC_TOKEN` | _(leer)_ | deSEC API-Token für DNS-01-Challenges (erforderlich wenn deSEC verwendet wird) |

### Rate-Limits des Gateways

Anfragen pro Minute und Client-IP, die Caddy zulässt, bevor es mit `429` antwortet. Optional: Ohne Wert gilt der Standard, und `alfheim-setup --reconfigure` behält einen gesetzten Wert. Siehe [Rate-Limits des Gateways anpassen](../how-to/tune-rate-limits.md).

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `ALFHEIM_RATE_LIMIT_LOGIN` | `30` | Formular-Posts an den Zitadel-Login (`POST /ui/login/*`, `/ui/v2/login/*`) |
| `ALFHEIM_RATE_LIMIT_AUTH` | `600` | Jede Anfrage an den `auth.*`-Host |
| `ALFHEIM_RATE_LIMIT_API` | `1200` | Jede `/api/v1`-Anfrage |
| `ALFHEIM_RATE_LIMIT_LOOKUP` | `60` | ISBN-/BGG-/TMDB-Lookups der Bibliothek und Barcode-Lookups der Vorratskammer |

---

## PostgreSQL-Datenbankberechtigungen

Microservice-spezifische Datenbankbenutzer und Datenbanken, erstellt auf dem gemeinsamen `postgres-core`-Container:

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `postgres` | PostgreSQL-Superbenutzer (verwendet für Initial-Setup) |
| `POSTGRES_PASSWORD` | `super_secret_local_password` | PostgreSQL-Superbenutzer-Passwort |
| `POSTGRES_DB` | `postgres` | Standard-PostgreSQL-Datenbankname |
| `{SERVICE}_POSTGRES_USER` | `{service}_user` | Datenbankbenutzer für einen Dienst (z.B. `DASHBOARD_POSTGRES_USER`) |
| `{SERVICE}_POSTGRES_PASSWORD` | `postgres` | Datenbankpasswort für einen Dienst |
| `{SERVICE}_POSTGRES_DB` | `alfheim_{service}` | Datenbankname für einen Dienst |
