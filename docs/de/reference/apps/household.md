---
title: "Haushalt & Rollen"
description: "Tier-1-Kern-App, der Haushalte, Mitglieder und Rollen, Einladungen, das Haushalts-Adressbuch und Benutzerprofile gehören und die Mitgliedschaftsprüfungen für alle anderen Backends beantwortet."
---

> **Kurzfassung:** Tier-1-Kern-App, der Haushalte, Mitglieder und Rollen, Einladungen, das Haushalts-Adressbuch und Benutzerprofile gehören. Jedes andere Backend fragt sie, ob ein Benutzer zu einem Haushalt gehört.

Quelle: [`core/household/`](https://github.com/KroegerLeif/Alfheim/tree/main/core/household)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Zitadel authentifiziert nur | Verwaltet Haushaltsmitgliedschaften und Rollen, die Quelle der Wahrheit für die Autorisierung ([ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md)) |
| Ein Zuhause mit anderen teilen | Einladungen mit QR-Code und Beitrittslink (`/household/join?token=…`), Rollen `OWNER`, `ADMIN`, `MEMBER`, `GUEST` |
| Mehrere Haushalte pro Benutzer | Standard-Haushalt pro Benutzer, Anlegen, Verlassen, Löschen und Eigentümerwechsel |
| Haushaltskontakte | Adressbuch mit Kategorien, pro Haushalt |
| Benutzerprofil | `GET/PUT /api/v1/profile/me` |

---

## 🏗️ Architektur & Tech-Stack

- **Backend:** Go (`household-backend`, Chi, `pgxpool`, golang-migrate), Zitadel-JWT-Middleware.
- **Frontend:** Next.js (`household-frontend`, basePath `/household`) mit `@alfheim/shared`.
- **Datenbank:** `alfheim_household` auf `postgres-core`, Eigentümer `household_user`.

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway- & Netzwerk-Matrix
| Dienst | Interner Port | Host-Zuordnung / Gateway-Route | Beschreibung |
| :--- | :--- | :--- | :--- |
| `household-backend` | 8080 | `/api/v1/households*`, `/api/v1/profile*` (Pfad bleibt erhalten) | Öffentliche REST-API, Zitadel-JWT erforderlich |
| `household-backend` | 8080 | `/internal/*` wird von Caddy **nie** geroutet (`404`) | Interne Mitgliedschafts-API auf `gateway-net` / `core-net` |
| `household-frontend` | 3000 | `/household*` | Next.js-Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://household_user:…@postgres-core:5432/alfheim_household?sslmode=disable` | PostgreSQL-Verbindungszeichenkette |
| `OIDC_ISSUER_URL` / `OIDC_AUDIENCE` | `https://auth.loegien.de` / `alfheim` | JWT-Prüfung für die öffentliche API |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Schützt die interne API. Ist es nicht gesetzt, antwortet die interne API mit `503`, und jede haushaltsbezogene Anfrage in anderen Apps schlägt fehl |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1` | Browser-API-Basis-URL des Frontends |

Die Datenbank-Variablen stehen in der [Referenz der Umgebungsvariablen](../environment-variables.md#haushalts---rollendienst-corehousehold).

---

## 🔐 Autorisierungsmodell

- Die öffentliche API autorisiert nur über `household_members`, anhand der Haushalts-ID im URL-Pfad. `X-Household-ID` und `X-Household-Role` werden ignoriert.
- Nur der Eigentümerwechsel (Transfer Ownership) ändert den Eigentümer. Einladungen und Rollenänderungen vergeben nie `OWNER`.
- Der erste Haushalt, den ein Benutzer anlegt oder dem er beitritt, wird sein Standard-Haushalt.

### Interne Mitgliedschafts-API

```text
GET /internal/v1/memberships/{householdId}/{userSub}
Authorization: Bearer <ALFHEIM_INTERNAL_TOKEN>
```

| Status | Bedeutung |
| :--- | :--- |
| `200` | `{"household_id": "<uuid>", "user_id": "<sub>", "role": "OWNER\|ADMIN\|MEMBER\|GUEST"}` |
| `400` | `householdId` ist keine UUID |
| `401` | Token fehlt oder ist falsch |
| `404` | Der Haushalt existiert nicht, oder der Benutzer ist kein Mitglied |
| `503` | `ALFHEIM_INTERNAL_TOKEN` ist nicht konfiguriert |

Python-Backends rufen sie über `backend_shared.household.require_household` auf, das Chat-Backend über `internal/shared/householdclient`. Die vollständigen Routen- und Rollentabellen stehen in [`core/household/backend/README.md`](../../../../core/household/backend/README.md).

---

## 🖥️ Frontend-Routen

| URL | Seite |
| :--- | :--- |
| `/household` | Haushaltsliste, Anlegen und Beitreten |
| `/household/[id]` | Mitglieder, Rollen, Einladungen, Adresse, Kontakte, Einstellungen |
| `/household/onboarding` | Anlegen oder Beitreten; vom `HouseholdGate` jeder App verlinkt, wenn der Benutzer keinen Haushalt hat |
| `/household/join?token=<token>` | Löst eine Einladung nach der Anmeldung ein (Ziel des QR-Codes) |
| `/household/profile` | Benutzerprofil |
