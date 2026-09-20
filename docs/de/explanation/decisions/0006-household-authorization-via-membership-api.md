---
title: "ADR 0006: Haushalts-Autorisierung über die Mitgliedschafts-API"
description: "Backends autorisieren X-Household-ID, indem sie die Mitgliedschafts-API von core/household fragen, statt Haushalts-Claims aus dem Zitadel-Token zu lesen."
sidebar:
  label: "0006 Haushalts-Autorisierung"
---

* Status: akzeptiert
* Deciders: Alfheim Core Architecture Team
* Datum: 2026-09-19

Technische Story: Sprints 1–2 der Haushalts-Extraktion (#479–#490)

---

## Kontext und Problembeschreibung

[ADR 0003](./0003-migrate-from-keycloak-to-zitadel.md) beschränkt Zitadel auf die Authentifizierung (AuthN). Haushaltsmitgliedschaften und Rollen bleiben in Alfheim. Sie liegen jetzt in der Tier-1-App `core/household`, die sie vom Dashboard übernommen hat.

Die Backends haben diese Trennung nicht umgesetzt. Jedes verglich den Request-Header `X-Household-ID` mit den Claims `household_id` / `active_household_id` im Access-Token und las Rollen aus `realm_access.roles`. Zitadel stellt keines davon aus. Deshalb wurde jede haushaltsbezogene Anfrage mit diesem Header mit `403` abgelehnt, und jede Rollenprüfung sah eine leere Liste. Die Claim-Auswertung war außerdem mehrfach vorhanden: in den Python-Apps, in einem abgespaltenen Modul in Budget und im Go-Chat-Backend, und die Varianten stimmten nicht immer überein.

Wie soll ein Backend entscheiden, ob der Aufrufer im Haushalt aus `X-Household-ID` handeln darf, und mit welcher Rolle?

---

## Entscheidungs-Treiber

* **Eine Quelle der Wahrheit:** Mitgliedschaften und Rollen gehören `core/household` und dürfen nicht in ein anderes System kopiert werden.
* **Sofortige Wirkung:** Das Entfernen eines Mitglieds oder eine Rollenänderung muss wirken, ohne dass sich der Benutzer neu anmeldet.
* **Fail closed:** Lässt sich die Mitgliedschaft nicht feststellen, wird die Anfrage abgelehnt.
* **Kleine Oberfläche für neue Apps:** eine Dependency in Python, eine Middleware in Go, ein Fehlervertrag.
* **Austauschbar:** Der Haushaltsdienst muss sich später verschieben oder neu schreiben lassen, ohne jede App zu ändern.

---

## Betrachtete Optionen

* **Option 1: Mitgliedschafts-Claims im Zitadel-Token** — Zitadel Actions fügen Haushalts-IDs und Rollen in das Access-Token ein.
* **Option 2: Signiertes Haushalts-Token** — `core/household` stellt ein kurzlebiges, signiertes Token für den aktiven Haushalt aus, das Frontends bei jeder Anfrage mitsenden.
* **Option 3: Gateway-`forward_auth`** — Caddy fragt `core/household` vor dem Weiterleiten und gibt das Ergebnis in vertrauenswürdigen Headern an das Backend weiter.
* **Option 4: Mitgliedschafts-API-Abfrage in jedem Backend** — jedes Backend prüft das JWT selbst, fragt dann `core/household` über eine interne API und cacht die Antwort kurz.

---

## Entscheidungs-Ergebnis

Gewählte Option: **Option 4 (Mitgliedschafts-API-Abfrage in jedem Backend)**, weil sie Mitgliedschaften an einem Ort hält, Änderungen innerhalb von Sekunden widerspiegelt und weder Zitadel-Anpassungen noch einen zusätzlichen Client-Flow braucht.

Der Vertrag:

* `core/household` stellt `GET /internal/v1/memberships/{householdId}/{userSub}` bereit, geschützt durch `Authorization: Bearer $ALFHEIM_INTERNAL_TOKEN`. Die Antwort ist `200 {household_id, user_id, role}` oder `404` für Nicht-Mitglieder. Caddy routet `/internal/*` nie.
* Python-Backends nutzen `backend_shared.household.require_household` (und `require_role`). Das Go-Chat-Backend nutzt `middleware.RequireHousehold` mit `internal/shared/householdclient`. Beide cachen Mitglieder 30 s und Nicht-Mitglieder 5 s und cachen Fehler nie.
* Rollen (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`) stammen aus der Mitgliedschafts-Antwort, nie aus Token-Claims.
* Fehler haben eine einheitliche Form, `{"detail": {"code", "message"}}`: `401 unauthenticated`, `400 household_required`, `400 household_invalid`, `403 household_forbidden`, `403 household_role_forbidden` und `503 household_service_unavailable`.
* MCP-Tools beziehen den Haushalt nur aus dem Request-Kontext. Das Chat-Backend leitet das Bearer-Token des Aufrufers und `X-Household-ID` an die MCP-Server weiter. Tools akzeptieren nie ein Haushalts-Argument vom LLM.
* Frontends senden nur `X-Household-ID`. Sie beziehen ihn aus `HouseholdProvider` / `useActiveHousehold` in `@alfheim/shared` und rendern hinter `HouseholdGate`.

### Positive Konsequenzen

* Haushaltsbezogene Anfragen funktionieren: Das `403` bei jeder Anfrage ist behoben.
* Änderungen an Mitgliedschaften und Rollen wirken innerhalb des Cache-Fensters (höchstens 30 s), ohne neue Anmeldung.
* Eine Implementierung pro Sprache ersetzt die doppelte Claim-Auswertung, einschließlich des abgespaltenen Auth-Moduls in Budget.
* Der Haushaltsdienst wird über eine URL erreicht (`HOUSEHOLD_INTERNAL_URL`). Wird er verschoben, ausgelagert oder ersetzt, ändert sich nur diese URL, solange der Vertrag der internen API gleich bleibt.

### Negative Konsequenzen & akzeptierte Kosten

* **Latenz:** Ein Cache-Miss kostet einen zusätzlichen internen HTTP-Aufruf (Timeout 2 s in Python, 3 s in Go). Der Cache gilt pro Prozess, jede Backend-Replik wärmt ihn also selbst auf.
* **Veralteter Zugriff:** Ein entferntes Mitglied kann bis zu 30 s weiter zugreifen. Ein gerade beigetretener Benutzer kann bis zu 5 s abgewiesen werden.
* **Laufzeit-Abhängigkeit:** Jede haushaltsbezogene Anfrage hängt von `household-backend` ab. Ist es nicht erreichbar, schlagen Anfragen mit `503 household_service_unavailable` fehl. Compose startet jeden Nutzer erst, wenn `household-backend` healthy ist.
* **Gemeinsames Secret:** `ALFHEIM_INTERNAL_TOKEN` muss an jedes Backend verteilt werden und darf nie in den Browser gelangen.

---

## Vor- und Nachteile der Optionen

### Option 1: Mitgliedschafts-Claims im Zitadel-Token

* Gut, weil Backends ohne zusätzlichen Aufruf autorisieren könnten.
* Schlecht, weil Mitgliedschaften in Zitadel kopiert würden, entgegen ADR 0003.
* Schlecht, weil ein Claim bis zum Ablauf des Tokens gilt; das Entfernen von Mitgliedern verzögert sich um die Token-Lebensdauer.
* Schlecht, weil Zitadel-Actions-Code nötig wäre, der schwer zu testen ist und vom Installer provisioniert werden müsste.

### Option 2: Signiertes Haushalts-Token

* Gut, weil Backends es offline mit einem öffentlichen Schlüssel prüfen können.
* Schlecht, weil Frontends einen zweiten Token-Flow mit Refresh- und Wechsel-Logik bräuchten.
* Schlecht, weil das Entfernen bis zum Ablauf des Haushalts-Tokens verzögert wird und ein Widerruf wieder eine Online-Prüfung bräuchte.
* Schlecht, weil `core/household` Schlüssel verwalten müsste.

### Option 3: Gateway-`forward_auth`

* Gut, weil Backends nichts von Haushalten wissen müssten.
* Schlecht, weil Backends vom Gateway gesetzten Headern vertrauen würden; das bricht bei internen Service-zu-Service- und MCP-Aufrufen, die nicht über Caddy laufen.
* Schlecht, weil jede geroutete Anfrage, auch statische Assets, die Prüfung bezahlen würde, sofern die Regeln nicht sorgfältig eingeschränkt sind.
* Schlecht, weil die Autorisierung in das vom Installer gerenderte Caddyfile wandern würde, wo sie schwer zu testen ist.

### Option 4: Mitgliedschafts-API-Abfrage in jedem Backend

* Gut, weil `core/household` die einzige Quelle der Wahrheit bleibt.
* Gut, weil es für REST-, MCP- und Service-zu-Service-Aufrufe gleich funktioniert.
* Gut, weil Fehlervertrag und Caching einmal pro Sprache definiert sind.
* Schlecht, weil ein Cache-Miss Latenz kostet und eine Laufzeit-Abhängigkeit von `household-backend` entsteht.
