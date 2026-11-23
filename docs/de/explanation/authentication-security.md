---
title: "Authentifizierung & Mandantenfähigkeit"
description: "Architektonische Einordnung der generischen OIDC-PKCE-Authentifizierung mit Zitadel, der JWT-Verifikation und der Mandantentrennung über Haushaltskontexte."
sidebar:
  label: "Authentifizierung"
---

> **Kurzfassung:** Architektonische Einordnung der generischen OIDC-PKCE-Authentifizierung mit Zitadel, der JWT-Token-Verifikation und der Mandantentrennung über Haushaltskontexte (`X-Household-ID`).

---

## 📋 Inhalt
- [Identity-Provider-Architektur (Zitadel)](#identity-provider-architektur-zitadel)
- [Trennung der Zuständigkeiten: AuthN vs. AuthZ](#trennung-der-zuständigkeiten-authn-vs-authz)
- [Authentifizierungsablauf (generisches OIDC PKCE)](#authentifizierungsablauf-generisches-oidc-pkce)
- [JWT-Claims & Nutzeridentität](#jwt-claims--nutzeridentität)
- [Installations-Operatoren (`alfheim_operator`)](#installations-operatoren-alfheim_operator)
- [Mandantentrennung (`X-Household-ID`)](#mandantentrennung-x-household-id)
- [Mandantensicherheit der FastMCP-KI-Agenten](#mandantensicherheit-der-fastmcp-ki-agenten)
- [Haushaltskontext im Frontend](#haushaltskontext-im-frontend)

---

## Identity-Provider-Architektur (Zitadel)

Alfheim nutzt **Zitadel** als schlanken, in Go geschriebenen Identity- und Access-Management-Provider (IAM). Zitadel arbeitet als zentraler OIDC-Identitätsserver, verwaltet Zugangsdaten, primäre Profilattribute und Sicherheitsmerkmale — bei minimalem Speicherbedarf (< 150 MB RAM).

* **Öffentlicher Issuer-Endpunkt**: der blanke Origin des IAM-Hosts — produktiv `https://auth.loegien.de`, lokal `http://auth.alfheim.loegien.localhost` (konfiguriert über `OIDC_ISSUER_URL`). Zitadel unterstützt kein Sub-Path-Hosting.
* **Interner Docker-JWKS-Endpunkt**: `http://zitadel:8080/oauth/v2/keys`
* **Protokollstandard**: Generic OpenID Connect (OIDC) 1.0 & OAuth 2.0 PKCE

### Zitadel-Version und Login-Oberfläche

Alfheim betreibt Zitadel v4 (`ghcr.io/zitadel/zitadel:v4.20.3`), festgeschrieben in `compose.prod.yaml` und `infrastructure/compose.yml`. Zwei Einstellungen in diesen Dateien prägen jede neue Instanz; Zitadel liest `ZITADEL_DEFAULTINSTANCE_*` und `ZITADEL_FIRSTINSTANCE_*` nur beim Anlegen einer Instanz, spätere Änderungen wirken sich auf eine bestehende Instanz also nicht aus:

* **Login V1 bleibt die Login-Oberfläche** (`ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED=false`). Sonst würde Zitadel v4 neue Instanzen jede Authorize-Anfrage an Login V2 unter `/ui/v2/login` schicken lassen, einen separaten Next.js-Container (`zitadel-login`) mit eigenem Login-Client-Token. Login V1 liefert das Zitadel-Binary selbst unter `/ui/login` aus, wird in v4 weiterhin unterstützt und zeigt bereits Buttons für externe Identity-Provider. Es kostet keinen zusätzlichen Container und keinen Speicher, und Caddy leitet den gesamten Auth-Host weiter an genau ein Upstream.
* **Tokens werden mit RSA-Web-Keys signiert** (`ZITADEL_DEFAULTINSTANCE_WEBKEYS_TYPE=rsa`, auch der Standard von v4). Seit v4 sind Web Keys die einzigen Signierschlüssel, und der JWKS listet sie. Jedes Backend lädt den JWKS über das Discovery-Dokument des Issuers und akzeptiert nur `RS256`, daher muss der Schlüsseltyp RSA bleiben.

Der Installer und `alfheim-setup provision` konfigurieren Projekte, OIDC-Anwendungen, Projektrollen, Rollenzuweisungen und die eigenen Schlüssel des Provisioning-Maschinennutzers über die v2-Dienste von Zitadel (`zitadel.project.v2`, `zitadel.application.v2`, `zitadel.authorization.v2`, `zitadel.user.v2`). Sie ersetzen die Management API v1, die Zitadel v5 entfernt (#915). Drei Bereiche nutzen weiter die v1-APIs, weil Zitadel 4 dafür noch keine schreibende v2-API hat: die Login-Policy (Registrierung, externer Login, verknüpfte Provider), die Identity-Provider-Vorlagen (Google, Apple) und der SMTP-Provider. Die [Installer-Referenz](../reference/installer-cli.md#zitadel-apis) listet jeden Aufruf.

### Wie sich der Installer bei Zitadel anmeldet

Das Provisioning läuft als eigener Maschinenbenutzer (`ZITADEL_BOOTSTRAP_USERNAME`, IAM-Owner), den Zitadel mit seiner ersten Instanz anlegt. Frühere Releases bewahrten das persönliche Zugriffstoken (PAT) dieses Benutzers in der `.env` auf, gültig bis 2519; eine geleakte `.env` bedeutete damit dauerhafte Kontrolle über den Identity-Provider (Issue #789). Seitdem hält der Installer kein langlebiges Token mehr:

* **Erster Lauf.** Zitadel schreibt beim Anlegen der Instanz einmalig ein PAT nach `infrastructure/zitadel/machinekey/pat.txt`. Es läuft zu `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE` ab, eine Woche nachdem der Installer die `.env` erzeugt hat. Das Provisioning verwendet das PAT einmal, um für denselben Benutzer einen Maschinenschlüssel zu registrieren, speichert ihn in `infrastructure/zitadel/provisioner/machine-key.json` (Verzeichnis `0700`, Datei `0600`, Eigentümer ist der Benutzer des Installers), löscht in Zitadel jedes PAT des Maschinenbenutzers, löscht `pat.txt` und leert `ZITADEL_BOOTSTRAP_PAT` in der `.env`.
* **Jeder Lauf.** Der Installer signiert mit dem gespeicherten Schlüssel ein JWT und tauscht es am Token-Endpunkt von Zitadel (JWT Profile Grant, RFC 7523) gegen ein Access-Token. Dieses Token existiert nur im Speicher und läuft nach der Access-Token-Lebensdauer von Zitadel ab (standardmäßig 12 Stunden). Danach rotiert der Lauf den Schlüssel: Er registriert einen neuen Schlüssel mit 90 Tagen Laufzeit, prüft, dass er funktioniert, ersetzt die Datei und löscht jeden anderen Schlüssel des Maschinenbenutzers. Ein bereits vorhandenes Verzeichnis mit lockereren Rechten (etwa aus einem Git-Checkout) setzt er dabei auf `0700`.
* **Wiederherstellung.** Lehnt Zitadel den gespeicherten Schlüssel ab (er lief nach 90 Tagen ohne Lauf ab oder gehört zu einer früheren Installation), greift der Installer auf ein PAT aus `pat.txt`, `ZITADEL_BOOTSTRAP_PAT` oder `alfheim-setup provision --pat-file` zurück und migriert erneut. Siehe [Eine Installation aktualisieren](../how-to/update-installation.md#fehlerbehebung).

Danach enthält die `.env` keine Zitadel-Zugangsdaten mehr. Der Maschinenschlüssel ist die einzige langlebige Zugangsinformation, die der Installer behält, mit diesen Grenzen:

* Er verlässt den Host nur innerhalb eines Backups und liegt außerhalb der `.env` und außerhalb des Verzeichnisses, das in den Zitadel-Container eingehängt ist.
* Wer ihn lesen kann, kann bereits die `.env` lesen, die `ZITADEL_MASTERKEY` und das Passwort des PostgreSQL-Superusers enthält und damit vollen Zugriff auf die Daten von Zitadel gibt. Bei einer Kompromittierung des Hosts bringt der Schlüssel kein zusätzliches Recht.
* Jeder Installer-Lauf (`update`, ein erneuter Lauf, `provision`) widerruft den vorherigen Schlüssel. Eine Kopie aus einem älteren Backup oder Disk-Image funktioniert daher ab dem nächsten Lauf nicht mehr, und ein unbenutzter Schlüssel läuft nach 90 Tagen von selbst ab.
* Für manuelle API-Aufrufe gibt `alfheim-setup zitadel-token` ein kurzlebiges Access-Token aus, statt den Schlüssel oder ein PAT offenzulegen.

### Social Login (Google, Apple)

Social Login ist pro Installation optional: `alfheim-setup` richtet Google oder Apple nur dann als Identity-Provider in Zitadel ein, wenn der Betreiber die Zugangsdaten angibt (siehe [Set up social login](../../en/how-to/social-login.md) (englisch)). Die Richtlinie ist in [ADR 0008](../../en/explanation/decisions/0008-social-login-policy.md) (englisch) festgehalten. Die lokale Registrierung mit Benutzername und Passwort bleibt in jedem Fall aus.

* Alle Frontends teilen sich einen öffentlichen PKCE-Client (`ALFHEIM_WEB_CLIENT_ID`). Die Identity-Provider hängen an der Zitadel-Instanz, nicht am Client, daher ändern sich Redirect-URIs, Grant-Typen und Projektrollen nicht.
* Login V1 zeigt auf der bestehenden Login-Seite einen Button pro Provider. Der Provider leitet zurück an den eigenen Callback von Zitadel auf dem Auth-Host (`/ui/login/login/externalidp/callback`, und `/callback/form` für den Formular-POST von Apple); Caddy reicht ihn unverändert durch.
* Backends erkennen Benutzer nur an der Zitadel-`sub`. Wer sich über Google oder Apple anmeldet, ist ein normaler Zitadel-Benutzer, Haushaltsmitgliedschaft und die Rolle `alfheim_operator` funktionieren also genauso.

Erste Anmeldung über einen Provider:

1. **Provider.** Der Benutzer authentifiziert sich bei Google oder Apple und wird zum Callback von Zitadel zurückgeschickt.
2. **Zitadel-Benutzer.** Zitadel meldet den Benutzer an, der bereits mit dieser externen Identität verknüpft ist. Andernfalls verknüpft es die Identität mit einem bestehenden Benutzer, dessen E-Mail-Adresse auf beiden Seiten verifiziert ist, oder legt einen neuen Benutzer an. Eine nicht verifizierte Adresse wird nie verknüpft.
3. **Mitgliedschaftsprüfung.** Das Frontend erhält gewöhnliche Tokens und fragt `core/household` nach den Haushalten des Benutzers (`GET /api/v1/households/me`). Jeder haushaltsbezogene Aufruf wird gegen `core/household` geprüft; das Token trägt weder Haushalt noch Rolle.
4. **Onboarding.** Ein neuer Benutzer hat keinen Haushalt. Er nimmt eine Einladung an oder legt einen eigenen Haushalt an; bis dahin sind keine Haushaltsdaten erreichbar.

Mit aktivem Social Login kann sich jeder mit einem Konto bei diesem Provider anmelden, der die Instanz erreicht, und einen eigenen Haushalt anlegen. Soll die Instanz geschlossen bleiben, die Zielgruppe beim Provider einschränken (siehe ADR).

---

## Trennung der Zuständigkeiten: AuthN vs. AuthZ

Für klare Architekturgrenzen und eine schlanke externe Identitätsinfrastruktur trennt Alfheim Authentifizierung und Haushalts-Autorisierung strikt:

1. **Identität & Authentifizierung (AuthN — Zitadel)**:
   - Zitadel ist ausschließlich für globale Identitätsprüfung, Authentifizierung (Passwörter, MFA, OIDC-Tokens) und Profilverwaltung zuständig (`sub`, `email`, `preferred_username`).
   - Zitadel verwaltet weder fachliche Anwendungsdaten noch komplexe Haushaltsmitgliedschaften.

2. **Haushalts-Autorisierung & Kontext (AuthZ — `core/household`)**:
   - Die Tier-1-App `core/household` verwaltet Haushalte, Einladungen, Mitgliedsrollen (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`), Kontakte und das Benutzerprofil. Sie ist die einzige Quelle der Wahrheit dafür, wer zu welchem Haushalt gehört.
   - Zitadel stellt keine Haushalts- oder Rollen-Claims aus. Backends lesen sie nie, sondern fragen `core/household` (siehe [ADR 0006](./decisions/0006-household-authorization-via-membership-api.md)).
   - Das Dashboard ist an der Haushalts-Autorisierung nicht beteiligt. Es liefert nur Launcher, App-Katalog, Benutzer-Links und -Einstellungen (sowie Telemetrie) und ignoriert `X-Household-ID` / `X-Household-Role`.

---

## Authentifizierungsablauf (generisches OIDC PKCE)

1. **Authorization Grant**: Frontends leiten nicht authentifizierte Nutzer per Standard-OIDC-Authorization-Code-Flow mit PKCE (`S256`) an Zitadel weiter.
2. **Token-Austausch**: Zitadel stellt ein `RS256`-signiertes JWT-Access-Token mit den Standard-Identity-Claims aus (`sub`, `email`, `preferred_username`).
3. **Session & Header**: Frontends legen das Access-Token im Session Storage ab und hängen `Authorization: Bearer <token>` an ausgehende API-Aufrufe. Haushaltsbezogene Aufrufe tragen zusätzlich `X-Household-ID: <UUID des aktiven Haushalts>`. Frontends senden nie `X-Household-Role`.
4. **Token-Prüfung**: Backends akzeptieren nur `RS256`. Die Go-Middleware der Dashboard-, Household- und Chat-Backends (`internal/shared/middleware/auth.go`) parst Tokens mit `jwt.WithValidMethods([]string{"RS256"})`, die Python-Backends prüfen mit `algorithms=["RS256"]` in `backend_shared`. Ein mit einem anderen Algorithmus signiertes Token (etwa `EdDSA` oder `ES256`) wird mit `401` abgelehnt.

### Cross-Origin-Anfragen (CORS)

Das Gateway setzt bewusst keine CORS-Header. Jedes Frontend ruft seine API über den eigenen Origin auf (relative Pfade `/api/v1/...` auf dem App-Host, siehe [Ingress-Matrix](../reference/ingress-matrix.md)), Browser senden also nie eine Cross-Origin-API-Anfrage und brauchen keinen Preflight. Beliebige Origins am Gateway samt Credentials zu spiegeln, würde jeder Website erlauben, authentifizierte Antworten zu lesen.

Die Backends registrieren dennoch eine CORS-Middleware mit einer exakten Origin-Allowlist (#921): `CORS_ORIGINS` in den FastAPI-Backends (`backend_shared.cors`) und `CORS_ALLOWED_ORIGINS` in den Go-Backends (`httpmw.ResolveAllowedOrigins`). `compose.prod.yaml` setzt beide aus `ALFHEIM_CORS_ORIGINS`, das der Installer als öffentlichen App-Origin (`ALFHEIM_BASE_URL`) rendert; ein produktives Backend beantwortet einen Preflight also nur für den eigenen Origin. Ungesetzt bedeutet in Produktion: gar kein Cross-Origin-Zugriff. Die Entwicklungs-Hosts (`http://localhost:3000`, `:5173`, `:8000`, `http://alfheim.loegien.localhost`, `http://api.alfheim.loegien.localhost`) sind nur außerhalb der Produktion der Standard. Jeder Eintrag muss ein exaktes `scheme://host[:port]` sein: Ein Wildcard, ein Pfad oder ein anderer fehlerhafter Eintrag stoppt das Backend beim Start, statt die Liste zu erweitern.

---

## JWT-Claims & Nutzeridentität

Zitadel stellt standardisierte OIDC-Identitäts-Tokens aus:

```json
{
  "iss": "https://auth.loegien.de",
  "sub": "usr_981231f2-8921-4831-a89f-2198129d1092",
  "aud": "alfheim-client",
  "preferred_username": "jules",
  "email": "jules@alfheim.local",
  "email_verified": true
}
```

---

## Installations-Operatoren (`alfheim_operator`)

Haushaltsrollen (`owner`, `admin`, `member`, `guest`) gelten nur innerhalb eines Haushalts, und jeder Nutzer kann einen Haushalt anlegen und dessen Owner werden. Sie schützen daher nie Ressourcen, die zur gesamten Installation gehören. Diese Ressourcen sind stattdessen an die Zitadel-Projektrolle `alfheim_operator` gebunden:

| Ressource | Operator | Alle anderen |
| --- | --- | --- |
| Dashboard-Systemmetriken und -Logs (`/api/v1/telemetry/*`) | erlaubt | `403 operator_required`; die Widgets werden durch einen kurzen Hinweis ersetzt |
| Chat-MCP-Registry: Server aktivieren oder deaktivieren (`PATCH /api/v1/chat/mcp-servers/{id}`) | erlaubt | `403 operator_required` |
| Chat-MCP-Registry: Diagnose (`GET /api/v1/chat/mcp-servers/diagnostics`) | erlaubt | `403 operator_required` |
| Chat-MCP-Registry: Liste (`GET /api/v1/chat/mcp-servers`) | vollständige Einträge samt interner Endpoint-URL | nur ID, App-Slug und Aktiv-Status |
| Grafana | `Admin` | abgewiesen |

Die Go-Backends lesen die Rolle aus dem validierten Access-Token. Zitadel legt sie im Claim `urn:zitadel:iam:org:project:roles` ab (sowie im projektbezogenen `urn:zitadel:iam:org:project:<projectId>:roles`), einem nach Rollen-Key geschlüsselten Objekt. Ein Claim anderer Form gewährt nichts. Voraussetzung sind Access-Token-Role-Assertion an der OIDC-Anwendung und JWT-Access-Tokens, was `alfheim-setup` bei Installation und bei jedem Update einrichtet. Das Dashboard-Frontend fragt `GET /api/v1/user/capabilities` (`{"operator": true|false}`) nur ab, um Bedienelemente auszublenden; die Backends erzwingen die Rolle bei jeder Anfrage.

`alfheim-setup` vergibt die Rolle an den initialen Administrator. Weitere Nutzer berechtigst du wie unter [Grafana-Zugriff gewähren](../how-to/grafana-access.md) beschrieben; dieselbe Rolle deckt Grafana, System-Telemetrie und die MCP-Registry ab. Nach der Vergabe braucht der Nutzer ein frisches Token (ab- und wieder anmelden).

---

## Mandantentrennung (`X-Household-ID`)

`X-Household-ID` *wählt* nur einen Haushalt aus. Der Header allein gewährt nichts: Jedes haushaltsbezogene Backend bestätigt die Mitgliedschaft des Aufrufers bei `core/household`, bevor es die Anfrage bedient.

1. **Token-Prüfung**: Das Backend prüft das JWT (Issuer, Signatur, Audience) und entnimmt den Benutzer aus `sub`. Fehlt das Token oder ist es ungültig, folgt `401 unauthenticated`.
2. **Header-Prüfung**: Die Anfrage muss `X-Household-ID` als UUID tragen. Fehlt er: `400 household_required`; keine UUID: `400 household_invalid`.
3. **Mitgliedschaftsabfrage**: Das Backend ruft die interne API der Haushalts-App auf:

   ```text
   GET {HOUSEHOLD_INTERNAL_URL}/internal/v1/memberships/{householdId}/{userSub}
   Authorization: Bearer {ALFHEIM_INTERNAL_TOKEN}
   ```

   `200` liefert die `role` des Mitglieds; `404` bedeutet kein Mitglied (`403 household_forbidden`). Caddy routet `/internal/*` nie, und `ALFHEIM_INTERNAL_TOKEN` gelangt nie in einen Browser.
4. **Rollenprüfung**: Routen, die eine Rolle verlangen (etwa das Umschalten der MCP-Registry im Chat, OWNER oder ADMIN), nutzen die Rolle aus der Mitgliedschafts-Antwort, nie einen Token-Claim. Ein Mitglied ohne passende Rolle erhält `403 household_role_forbidden`.
5. **Query-Filterung**: Repository-Queries filtern alle Lese-, Schreib-, Update- und Löschoperationen nach der bestätigten Haushalts-ID.

Python-Backends setzen die Schritte 1–4 mit `backend_shared.household.require_household` / `require_role` um. Die Go-Backends (Chat und die Haushalts-Launcher des Dashboards) nutzen `household.RequireHousehold` aus `packages/go-shared` (`alfheim/go-shared/household`), für Schreibzugriffe, die `OWNER` oder `ADMIN` verlangen, zusätzlich `household.RequireHouseholdRole`. Beide verhalten sich gleich:

| Status | `detail.code` | Bedeutung |
| :--- | :--- | :--- |
| `401` | `unauthenticated` | Kein gültiges JWT oder keine `sub` |
| `400` | `household_required` | `X-Household-ID` fehlt |
| `400` | `household_invalid` | `X-Household-ID` ist keine UUID |
| `403` | `household_forbidden` | Der Benutzer ist kein Mitglied dieses Haushalts |
| `403` | `household_role_forbidden` | Der Benutzer ist Mitglied, die Route verlangt aber eine andere Rolle |
| `503` | `household_service_unavailable` | Die Mitgliedschafts-API ist nicht erreichbar, lief in einen Timeout, antwortete mit 5xx, hat das interne Token abgelehnt, oder das Token ist nicht konfiguriert. Anfragen schlagen nie offen fehl |

Der Body ist immer `{"detail": {"code": "...", "message": "..."}}`.

**Rollenmatrix der Python-Apps:** `GUEST` darf nur lesen. Jede ändernde Route und jedes MCP-Tool verlangt mindestens `MEMBER`. Das Löschen gemeinsamer Strukturen verlangt `ADMIN` oder `OWNER`: Budget-Konten, -Töpfe und -Pläne; Library-Anbieter und -Standorte; Pantry-Standorte und -Kategorien; Haushaltsaufgaben-Vorlagen; haushaltsweite Workout-Geräte und -Übungen. Persönliche Ressourcen bleiben für jede Rolle offen, weil sie nur die eigenen Daten des Aufrufers betreffen: Workout-Pläne, -Sitzungen, -Favoriten, -Präferenzen und Katalog-Einträge mit `scope=user` sowie die persönliche Einkaufsliste. MCP-Tools wenden dieselbe Regel auf die Rolle des Aufrufers an und weisen einen abgelehnten Aufruf mit einem Tool-Fehler zurück, der `household_role_forbidden` enthält. Die Frontends bilden die Matrix mit `useHouseholdCan` / `useHouseholdPermission` aus `@alfheim/shared` ab: Für `GUEST` blenden sie Schreib-Bedienelemente für gemeinsame Daten aus (und zeigen einen Hinweis auf den Lesezugriff), für `MEMBER` zeigen sie die Admin-Löschaktionen deaktiviert mit Tooltip. Durchgesetzt wird die Regel weiterhin im Backend.

**Caching:** Antworten werden pro Prozess gecacht, geschlüsselt nach Haushalt und Benutzer: Mitglieder 30 s, Nicht-Mitglieder 5 s. Fehler werden nie gecacht. Das Entfernen eines Mitglieds wirkt daher innerhalb von 30 s, ohne dass sich der Benutzer neu anmeldet.

**Service-zu-Service-Aufrufe:** Ruft eine App eine andere auf (etwa Shopping → Pantry, Maintenance → Budget), leitet sie das Bearer-Token des Aufrufers und `X-Household-ID` weiter. Die Ziel-App autorisiert den Aufrufer selbst; es gibt keine Service-Identität, die die Mitgliedschaftsprüfung umgeht.

Das Dashboard-Backend ist nicht haushaltsbezogen: Seine Daten (Einstellungen, Links) hängen an der `sub` des Benutzers. Es prüft `X-Household-ID` daher weder noch lehnt es den Header ab, und es liest oder setzt nie `X-Household-Role`. `core/household` autorisiert seine öffentliche API über die Haushalts-ID im URL-Pfad und ignoriert beide Header ebenfalls.

---

## Mandantensicherheit der FastMCP-KI-Agenten

MCP-Tools nehmen nie ein Haushalts- (oder Benutzer-)Argument vom LLM entgegen. Der Haushalt stammt nur aus dem Request-Kontext:

* Das Chat-Backend leitet `Authorization: Bearer <token>` und `X-Household-ID` des Aufrufers bei jedem JSON-RPC-Aufruf an einen MCP-Server weiter. Die Zugangsdaten werden pro Anfrage gesetzt, sodass die Identität eines Aufrufers nie für einen anderen wiederverwendet wird.
* Jede Python-App umschließt ihre MCP-App mit `MCPAuthenticationMiddleware`, die dieselben Token-, Header- und Mitgliedschaftsprüfungen wie die REST-API ausführt, mit demselben Fehlervertrag.
* Tools lesen den bestätigten Kontext mit `get_mcp_household_context()` und rufen dieselben Service-Funktionen wie die REST-Routen auf. MCP liest und schreibt so im selben Haushalt, den der Benutzer gewählt hat.

---

## Haushaltskontext im Frontend

Frontends beziehen den aktiven Haushalt aus `@alfheim/shared`:

* `HouseholdProvider` lädt die Haushalte des Benutzers über `GET /api/v1/households/me` (bereitgestellt von `core/household`) und wählt den aktiven: die gespeicherte ID, wenn sie noch eine Mitgliedschaft ist, sonst den Standard-Haushalt, sonst den ersten. Die Wahl liegt in `localStorage` unter `alfheim_active_household_id` und wird über Apps und Tabs synchronisiert.
* `useActiveHousehold()` liefert `{ status, householdId, role, ... }`. Haushaltsbezogene Queries warten auf `status === 'ready'` und nehmen die Haushalts-ID in ihre Query-Keys auf.
* `HouseholdGate` rendert die Seite nur, wenn ein Haushalt bereit ist. Sonst zeigt es eine Karte zum Anlegen oder Beitreten (Link auf `/household/onboarding`), nach `household_forbidden` Wechsel-Buttons, oder nach `household_service_unavailable` einen Hinweis zum erneuten Versuch.
* API-Clients setzen den Header mit `applyHouseholdHeaders` / `householdHeaders` und melden Haushaltsfehler mit `reportHouseholdErrorResponse`.
