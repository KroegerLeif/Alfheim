---
title: "Fehlersuche & Betrieb"
description: "Diagnoseverfahren und Lösungsschritte für häufige Betriebsprobleme bei Caddy-Ingress, Zitadel-OIDC-Authentifizierung, Datenbank-Verbindungspools und Container-Health."
sidebar:
  label: "Fehlersuche"
---

> **Kurzfassung:** Diagnoseverfahren und Lösungsschritte für häufige Betriebsprobleme bei Caddy-Ingress, Zitadel-OIDC-Authentifizierung, Datenbank-Verbindungspools und Container-Health.

---

## 📋 Inhalt
- [Diagnose-Ablauf & Cluster-Status](#diagnose-ablauf--cluster-status)
- [Caddy-Ingress & Routing-Probleme](#caddy-ingress--routing-probleme)
- [Zitadel-IAM & Token-Verifikationsfehler](#zitadel-iam--token-verifikationsfehler)
- [Fehler bei der Haushalts-Autorisierung](#fehler-bei-der-haushalts-autorisierung)
- [Datenbank-Locks & erschöpfte Verbindungspools](#datenbank-locks--erschöpfte-verbindungspools)
- [VictoriaStack-Telemetrie & Vector-Log-Puffer](#victoriastack-telemetrie--vector-log-puffer)

---

## Diagnose-Ablauf & Cluster-Status

Bevor du in einzelne Dienste einsteigst, arbeite die zentrale Checkliste ab:

### 1. Health-Status der Container prüfen
```bash
docker compose ps
```
Achte auf Container mit `unhealthy` oder `restarting`.

### 2. Logs des zentralen Caddy-Reverse-Proxys ansehen
```bash
docker logs --tail 100 -f alfheim_caddy
```

### 3. Automatisiertes Diagnose-Skript ausführen
```bash
./scripts/diagnose-mcp.sh
```

---

## Caddy-Ingress & Routing-Probleme

### Symptom 1: HTTP 502 Bad Gateway auf einem Microfrontend-Pfad
* **Ursache:** Der Ziel-Frontend-Container (z. B. `pantry-frontend`) startet noch oder scheitert an seinem Next.js-Healthcheck.
* **Lösung:**
  1. Container-Logs prüfen: `docker logs --tail 50 pantry-frontend`
  2. Netzwerkverbindung prüfen: `docker exec -it alfheim_caddy curl -I http://pantry-frontend:3000`
  3. Frontend neu starten: `docker compose restart pantry-frontend`

### Symptom 2: Loopback-DNS unter macOS bricht weg (`.localhost` löst nicht auf)
* **Ursache:** Docker Desktop unter macOS verliert nach dem Aufwachen aus dem Ruhezustand gelegentlich die Loopback-Bindings der Bridge-Netzwerke.
* **Lösung:**
  ```bash
  # Caddy-Routing ohne Ausfallzeit neu laden
  docker exec -it alfheim_caddy caddy reload --config /etc/caddy/Caddyfile
  ```

---

## Zitadel-IAM & Token-Verifikationsfehler

### Symptom 1: Microservice antwortet mit `401 Unauthorized` oder `Invalid Token Issuer`
* **Ursache:** Der Issuer, auf den der Browser weitergeleitet wird, stimmt nicht mit dem Issuer überein, gegen den das Backend verifiziert.
* **Lösung:** Stelle sicher, dass `OIDC_ISSUER_URL` in der `.env` der blanke Origin des IAM-Hosts ist (lokal `http://auth.alfheim.loegien.localhost`) und mit dem Redirect-Ziel des Browsers übereinstimmt. Zitadel läuft auf einem eigenen Host, nicht unter einem `/auth`-Unterpfad.

### Symptom 2: Dashboard zeigt *Secure connection (HTTPS) required*
* **Ursache:** Die App wurde über reines `http://` auf einem anderen Host als `localhost` geöffnet. Browser deaktivieren Web Crypto außerhalb eines sicheren Kontexts, und die PKCE-Anmeldung braucht es.
* **Lösung:** Dem `https://`-Link auf der Seite folgen. Eine Installer-Installation mit `internal` aus der Zeit, als diese Strategie noch kein HTTPS auslieferte, migriert mit `alfheim-setup --reconfigure`.

### Symptom 3: Dashboard zeigt *Sign-in service not reachable*
* **Ursache:** Die Browser-Anfrage an das Discovery-Dokument des Issuers auf dem Auth-Host ist ohne HTTP-Antwort gescheitert. Bei einer Installation mit TLS `internal` heißt das meist, dass dem Zertifikat des Auth-Hosts noch nicht vertraut wird, weil Zertifikatsausnahmen pro Host gespeichert werden. Es passiert auch, wenn Zitadel nicht läuft oder der Client offline ist.
* **Lösung:** Den Link auf der Seite öffnen, dem Zertifikat des Auth-Hosts vertrauen oder es akzeptieren und neu laden. Dauerhaft vermeiden lässt sich das, indem du [der lokalen Root-CA vertraust](./trust-local-root-ca.md). Andernfalls `docker compose ps zitadel caddy` prüfen.

---

## Fehler bei der Haushalts-Autorisierung

Haushaltsbezogene Backends bestätigen jede `X-Household-ID` bei der Haushalts-App (`core/household`). Fehler haben den Body `{"detail": {"code": "...", "message": "..."}}`; der Code zeigt, welcher Fall vorliegt. Den vollständigen Vertrag beschreibt [Authentifizierung & Mandantenfähigkeit](../explanation/authentication-security.md#mandantentrennung-x-household-id).

### Symptom 1: `400 household_required` oder `household_invalid`
* **Ursache:** Die Anfrage trug keinen `X-Household-ID`-Header (`household_required`) oder einen Wert, der keine UUID ist (`household_invalid`). Im Browser heißt das meist, dass die App eine haushaltsbezogene Anfrage gesendet hat, bevor ein Haushalt gewählt war, oder dass unter `alfheim_active_household_id` noch eine veraltete Nicht-UUID-ID liegt (etwa eine alte ganzzahlige Maintenance-ID).
* **Lösung:** Die App neu laden, damit `HouseholdGate` einen Haushalt wählen kann. Bleibt der Fehler, `alfheim_active_household_id` im Local Storage leeren und im Header-Umschalter einen Haushalt wählen. Ein Benutzer ganz ohne Haushalt sieht eine Karte mit Link auf `/household/onboarding`, um einen anzulegen oder beizutreten. API-Clients senden die UUID des Haushalts in `X-Household-ID`.

### Symptom 2: `403 household_forbidden`
* **Ursache:** Der Benutzer ist angemeldet, aber kein Mitglied des Haushalts aus `X-Household-ID`: Er hat ihn verlassen, wurde entfernt, der Haushalt wurde gelöscht, oder die ID gehört zu einem anderen Benutzer. Wer vor wenigen Sekunden beigetreten ist, kann das ebenfalls bis zu 5 s sehen, weil negative Antworten gecacht werden.
* **Lösung:** Im Header-Umschalter zu einem anderen Haushalt wechseln (das Gate bietet Wechsel-Buttons) oder dem Haushalt über eine Einladung erneut beitreten. Nach dem Beitritt einige Sekunden warten. Die Mitgliedschaft in der Haushalts-App unter `/household` prüfen.

### Symptom 3: `403 household_role_forbidden`
* **Ursache:** Der Benutzer ist Mitglied, die Aktion verlangt aber eine höhere Rolle. Zum Beispiel braucht das Umschalten eines MCP-Servers im Chat `OWNER` oder `ADMIN`. Rollen stammen aus `core/household`, nie aus dem Token.
* **Lösung:** Einen Owner oder Admin des Haushalts bitten, die Aktion auszuführen oder die Rolle des Benutzers unter `/household/<id>` zu ändern. Rollenänderungen wirken innerhalb von 30 s.

### Symptom 4: `503 household_service_unavailable`
* **Ursache:** Das Backend konnte die Mitgliedschaft nicht bestätigen und hat die Anfrage deshalb abgelehnt, statt offen fehlzuschlagen. Die Haushalts-App läuft nicht oder ist nicht erreichbar, lief in einen Timeout, antwortete mit 5xx, hat das interne Token abgelehnt (`401`), oder `ALFHEIM_INTERNAL_TOKEN` ist für das aufrufende Backend nicht gesetzt.
* **Lösung:**
  ```bash
  docker compose ps household-backend
  docker compose logs --tail 100 household-backend
  # Mitgliedschaftsfehler im aufrufenden Backend suchen, z. B. Pantry:
  docker compose logs --tail 100 pantry-backend | grep -i household
  ```
  Sicherstellen, dass `household-backend` healthy ist und jedes Backend dasselbe `ALFHEIM_INTERNAL_TOKEN` wie `household-backend` erhält (alle kommen aus der Wurzel-`.env`). `HOUSEHOLD_INTERNAL_URL` muss aus dem aufrufenden Container auflösbar sein (Standard `http://household-backend:8080`). Die Frontends zeigen einen Hinweis zum erneuten Versuch; nach der Wiederherstellung neu laden.

### Symptom 5: Alte Maintenance-Daten fehlen nach dem Update
* **Ursache:** Die Maintenance-Datenbank wurde angelegt, bevor Haushalts-IDs zu UUIDs wurden (ganzzahliges `device.household_id` plus lokale Tabelle `household`). Ganzzahlige IDs lassen sich nicht den UUID-Haushalten aus `core/household` zuordnen. Beim ersten Start nach dem Update verschiebt die Start-Migration (Revision `0002`) die vier alten Tabellen daher in das PostgreSQL-Schema `legacy_maintenance` und legt leere aktuelle Tabellen an. Es wird nichts gelöscht, die alten Zeilen werden aber nicht mehr ausgeliefert.
* **Lösung:** Für den Betrieb des Dienstes ist nichts nötig. Um alte Geräte zurückzuholen, im Schema `legacy_maintenance` nachsehen und sie in der App neu anlegen oder per SQL übernehmen, sobald klar ist, zu welchem Haushalt sie gehören:

  ```bash
  docker compose exec postgres-core sh -c 'psql -U "$POSTGRES_USER" -d alfheim_maintenance -c "SELECT id, name, household_id FROM legacy_maintenance.device;"'
  ```

  Werden die Daten nicht mehr gebraucht, mit `DROP SCHEMA legacy_maintenance CASCADE;` entfernen. Siehe [Schema-Migrationen](../explanation/schema-migrations.md).

---

## Datenbank-Locks & erschöpfte Verbindungspools

### Symptom 1: Pytest / FastAPI meldet `asyncpg.exceptions.TooManyConnectionsError`
* **Ursache:** Nicht geschlossene Datenbank-Sessions oder ein Leck in asynchronen Testschleifen.
* **Lösung:**
  ```bash
  # Untätige PostgreSQL-Verbindungen beenden
  docker exec -it alfheim_postgres_core psql -U postgres -d alfheim_pantry -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"
  ```

---

## VictoriaStack-Telemetrie & Vector-Log-Puffer

### Symptom 1: Vector meldet Verbindungs-Timeout (`127.0.0.1:8686`)
* **Ursache:** Der OTel Collector oder ein VictoriaMetrics-Container wurde neu gestartet, ohne dass Vector sein Socket-Binding aktualisiert hat.
* **Lösung:**
  ```bash
  # Health-Endpunkt von Vector prüfen
  curl http://127.0.0.1:8686/health

  # Telemetrie-Slice neu starten
  docker compose -f infrastructure/telemetry/compose.yml restart vector otel-collector
  ```
