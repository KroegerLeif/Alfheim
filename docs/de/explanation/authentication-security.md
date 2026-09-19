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
- [Mandantentrennung (`X-Household-ID`)](#mandantentrennung-x-household-id)
- [Mandantensicherheit der FastMCP-KI-Agenten](#mandantensicherheit-der-fastmcp-ki-agenten)
- [Haushaltskontext im Frontend](#haushaltskontext-im-frontend)

---

## Identity-Provider-Architektur (Zitadel)

Alfheim nutzt **Zitadel** als schlanken, in Go geschriebenen Identity- und Access-Management-Provider (IAM). Zitadel arbeitet als zentraler OIDC-Identitätsserver, verwaltet Zugangsdaten, primäre Profilattribute und Sicherheitsmerkmale — bei minimalem Speicherbedarf (< 150 MB RAM).

* **Öffentlicher Issuer-Endpunkt**: der blanke Origin des IAM-Hosts — produktiv `https://auth.loegien.de`, lokal `http://auth.alfheim.loegien.localhost` (konfiguriert über `OIDC_ISSUER_URL`). Zitadel unterstützt kein Sub-Path-Hosting.
* **Interner Docker-JWKS-Endpunkt**: `http://zitadel:8080/oauth/v2/keys`
* **Protokollstandard**: Generic OpenID Connect (OIDC) 1.0 & OAuth 2.0 PKCE

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
2. **Token-Austausch**: Zitadel stellt ein RSA256-/Ed25519-signiertes JWT-Access-Token mit den Standard-Identity-Claims aus (`sub`, `email`, `preferred_username`).
3. **Session & Header**: Frontends legen das Access-Token im Session Storage ab und hängen `Authorization: Bearer <token>` an ausgehende API-Aufrufe. Haushaltsbezogene Aufrufe tragen zusätzlich `X-Household-ID: <UUID des aktiven Haushalts>`. Frontends senden nie `X-Household-Role`.

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

Python-Backends setzen die Schritte 1–4 mit `backend_shared.household.require_household` / `require_role` um. Das Chat-Backend (Go) nutzt `middleware.RequireHousehold` mit `internal/shared/householdclient`. Beide verhalten sich gleich:

| Status | `detail.code` | Bedeutung |
| :--- | :--- | :--- |
| `401` | `unauthenticated` | Kein gültiges JWT oder keine `sub` |
| `400` | `household_required` | `X-Household-ID` fehlt |
| `400` | `household_invalid` | `X-Household-ID` ist keine UUID |
| `403` | `household_forbidden` | Der Benutzer ist kein Mitglied dieses Haushalts |
| `403` | `household_role_forbidden` | Der Benutzer ist Mitglied, die Route verlangt aber eine andere Rolle |
| `503` | `household_service_unavailable` | Die Mitgliedschafts-API ist nicht erreichbar, lief in einen Timeout, antwortete mit 5xx, hat das interne Token abgelehnt, oder das Token ist nicht konfiguriert. Anfragen schlagen nie offen fehl |

Der Body ist immer `{"detail": {"code": "...", "message": "..."}}`.

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
