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
  1. Container-Logs prüfen: `docker logs --tail 50 alfheim_pantry_frontend`
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

### Symptom 2: Fehler wegen fehlendem `X-Household-ID`-Header
* **Ursache:** Die Frontend-Session hat keinen aktiven Haushaltskontext gewählt.
* **Lösung:** Den Local-Storage-Schlüssel `alfheim_active_household_id` leeren oder den aktiven Haushalt im Header-Umschalter neu auswählen.

### Symptom 3: Chat antwortet nach der Haushaltsauswahl mit `403 Forbidden`
* **Ursache:** Das Chat-Backend übernimmt den Haushalt nur aus dem Claim `household_id` (oder `active_household_id`) des Access-Tokens. Eine Anfrage, deren `X-Household-ID`-Header einen anderen Haushalt nennt oder die mit einem Token ohne Haushalts-Claim gesendet wird, wird abgelehnt, wie es Dashboard und Python-Backends bereits tun.
* **Lösung:** Access-Token prüfen und sicherstellen, dass es einen zum gewählten Haushalt passenden Haushalts-Claim trägt. Wird `alfheim_active_household_id` geleert, entfällt der Header, und Chat beschränkt sich auf private Ressourcen. Zitadel stellt diesen Claim noch nicht aus, daher betrifft das derzeit jede Haushaltsauswahl; siehe [Bekannte Probleme](../explanation/known-issues.md).

### Symptom 4: Dashboard zeigt *Secure connection (HTTPS) required*
* **Ursache:** Die App wurde über reines `http://` auf einem anderen Host als `localhost` geöffnet. Browser deaktivieren Web Crypto außerhalb eines sicheren Kontexts, und die PKCE-Anmeldung braucht es.
* **Lösung:** Dem `https://`-Link auf der Seite folgen. Eine Installer-Installation mit `internal` aus der Zeit, als diese Strategie noch kein HTTPS auslieferte, migriert mit `alfheim-setup --reconfigure`.

### Symptom 5: Dashboard zeigt *Sign-in service not reachable*
* **Ursache:** Die Browser-Anfrage an das Discovery-Dokument des Issuers auf dem Auth-Host ist ohne HTTP-Antwort gescheitert. Bei einer Installation mit TLS `internal` heißt das meist, dass dem Zertifikat des Auth-Hosts noch nicht vertraut wird, weil Zertifikatsausnahmen pro Host gespeichert werden. Es passiert auch, wenn Zitadel nicht läuft oder der Client offline ist.
* **Lösung:** Den Link auf der Seite öffnen, dem Zertifikat des Auth-Hosts vertrauen oder es akzeptieren und neu laden. Dauerhaft vermeiden lässt sich das, indem du [der lokalen Root-CA vertraust](./trust-local-root-ca.md). Andernfalls `docker compose ps zitadel caddy` prüfen.

---

## Datenbank-Locks & erschöpfte Verbindungspools

### Symptom 1: Pytest / FastAPI meldet `asyncpg.exceptions.TooManyConnectionsError`
* **Ursache:** Nicht geschlossene Datenbank-Sessions oder ein Leck in asynchronen Testschleifen.
* **Lösung:**
  ```bash
  # Untätige PostgreSQL-Verbindungen beenden
  docker exec -it alfheim_pantry_db psql -U postgres -d pantry -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"
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
