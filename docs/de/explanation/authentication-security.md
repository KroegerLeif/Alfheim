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

2. **Haushalts-Autorisierung & Kontext (AuthZ — Alfheim Core)**:
   - Alfheim Core/Dashboard verwaltet Haushalts-Entitäten, Einladungen, Mitgliedsrollen (`owner`, `member`, `guest`) und Mandantengrenzen.
   - Microservices akzeptieren die von Zitadel authentifizierten Identitäts-Tokens und prüfen den Haushaltszugriff gegen den aktiven Haushaltskontext (`X-Household-ID`), der von Alfheim Core verwaltet wird.

---

## Authentifizierungsablauf (generisches OIDC PKCE)

1. **Authorization Grant**: Frontends leiten nicht authentifizierte Nutzer per Standard-OIDC-Authorization-Code-Flow mit PKCE (`S256`) an Zitadel weiter.
2. **Token-Austausch**: Zitadel stellt ein RSA256-/Ed25519-signiertes JWT-Access-Token mit den Standard-Identity-Claims aus (`sub`, `email`, `preferred_username`).
3. **Session & Header**: Frontends legen das Access-Token sicher im Session Storage ab und hängen sowohl `Authorization: Bearer <token>` als auch `X-Household-ID: <active_household_id>` an ausgehende API-Aufrufe.

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

Um strikte Mandantengrenzen über alle Microservices hinweg durchzusetzen:

1. **Header-Prüfung**: Die Backends prüfen, dass eingehende HTTP-Anfragen einen gültigen `X-Household-ID`-Header tragen.
2. **Autorisierungsprüfung**: Die Auth-Middleware (`backend_shared.auth` sowie die Go-Auth-Handler) validiert die Nutzeridentität (`sub`) und prüft die Haushaltsmitgliedschaft über Alfheim Core.
3. **Query-Filterung**: Alle Lese-, Schreib-, Update- und Löschoperationen im Repository-Layer filtern nach `household_id == active_household_id`.

---

## Mandantensicherheit der FastMCP-KI-Agenten

FastMCP-Agenten-Tools (aufgerufen von LLM-Clients wie ALFI) verlangen bei jeder Ausführung einen expliziten `household_id`-Parameter. Die Tool-Logik erzwingt die Haushaltsgrenzen, bevor Datenbankänderungen ausgeführt werden, und verhindert so haushaltsübergreifende Datenlecks.
