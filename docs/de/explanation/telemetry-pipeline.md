---
title: "VictoriaStack-Telemetrie-Pipeline"
description: "Die zentrale Observability-Pipeline: Log-Sammlung mit Vector, Metrik- und Trace-Routing über den OTel Collector, VictoriaMetrics, VictoriaLogs und Grafana."
---

> **Kurzfassung:** Architektonische Einordnung der zentralen Observability-Pipeline mit Log-Sammlung durch Vector, Metrik-/Trace-Routing über den OTel Collector sowie VictoriaMetrics, VictoriaLogs und Grafana.

---

## 📋 Inhalt
- [Aufbau des Observability-Stacks](#aufbau-des-observability-stacks)
- [Log-Sammlung & Normalisierung (Vector)](#log-sammlung--normalisierung-vector)
- [OpenTelemetry-Tracing & W3C-Traceparent-Header](#opentelemetry-tracing--w3c-traceparent-header)
- [Speicherung von Metriken & Logs (VictoriaMetrics & VictoriaLogs)](#speicherung-von-metriken--logs-victoriametrics--victorialogs)
- [Visualisierung (Grafana)](#visualisierung-grafana)

---

## Aufbau des Observability-Stacks

Alfheim setzt unter `infrastructure/telemetry` auf eine einheitliche Telemetrie-Architektur auf Basis von **VictoriaStack**:

```
┌─────────────────┐       ┌─────────────────┐
│ App-Backends    │       │ Docker-Socket   │
│ (Go & FastAPI)  │       │ (Stdout/Stderr) │
└────────┬────────┘       └────────┬────────┘
         │ OTLP-Traces             │ Klartext-/JSON-Logs
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│ OTel Collector  │       │ Vector          │
│ (Port 4317)     │       │ (Log-Sammler)   │
└────────┬────────┘       └────────┬────────┘
         │ Traces/Metriken         │ Strukturierte Logs
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│ VictoriaMetrics │       │ VictoriaLogs    │
│ (Port 8428)     │       │ (Port 9428)     │
└────────┬────────┘       └────────┬────────┘
         └───────────┬─────────────┘
                     ▼
            ┌─────────────────┐
            │ Grafana         │
            │ (Port 3000)     │
            └─────────────────┘
```

---

## Log-Sammlung & Normalisierung (Vector)

Vector (`infrastructure/telemetry/vector/vector.toml`) sammelt Container-Logs über einen schreibgeschützten Docker-Socket-Proxy (`docker-socket-proxy`, `wollomatic/socket-proxy`). Vector bindet `/var/run/docker.sock` nie selbst ein, weil Zugriff auf die Docker-API einem Root-Zugriff auf dem Host entspricht, auch wenn der Socket `:ro` gemountet ist.

Der Proxy hält den Socket und leitet nur die GET-Endpunkte weiter, die die `docker_logs`-Quelle benötigt (Version, Ping, Info, Events, Container-Liste, Inspect und Logs). Alle anderen Anfragen werden abgelehnt, einschließlich aller POST/PUT/DELETE-Aufrufe und des Datei-Archiv-Endpunkts von Containern. Der Proxy hängt am rein internen Netzwerk `docker-proxy-net`, das nur Vector erreichen kann und keine Route aus dem Host hinaus hat.

Wesentliche Funktionen:
* **Zusammenführung mehrzeiliger Stacktraces:** Fasst mehrzeilige Python-Tracebacks und Go-Panic-Traces (`\tat`, `\tgoroutine`) zu einem logischen Log-Ereignis zusammen.
* **Feld-Normalisierung:** Vereinheitlicht heterogene Log-Felder (`msg` → `message`) und Schweregrade (`WARN` / `WARNING` → `warn`, `ERROR` → `error`).
* **Ingestion:** Schickt die Batches direkt an die JSON-Lines-API von VictoriaLogs (`/insert/jsonline`), mit `service_name` (dem Containernamen) als Stream-Feld. Der Weg führt nicht über den OTel Collector, dessen Endpunkt `/v1/logs` nur OTLP-Payloads annimmt.
* **Health-Endpunkt:** Stellt interne Diagnose-Healthchecks unter `http://127.0.0.1:8686/health` bereit.

---

## OpenTelemetry-Tracing & W3C-Traceparent-Header

Verteiltes Request-Tracing über Microservice-Grenzen hinweg nutzt die W3C-`traceparent`-Kontextweitergabe:

1. **Header-Erzeugung**: `@alfheim/shared` erzeugt W3C-Traceparent-Header (`00-<trace_id>-<span_id>-01`) bei ausgehenden Frontend-API-Aufrufen (`fetchWithTrace`, `ApiClient`).
2. **Kontext-Extraktion**: Go- und Python-Backends extrahieren den Trace-Kontext in ihrer HTTP-Middleware.
3. **Injektion in strukturierte Logs**: Die Backends schreiben `trace_id` und `span_id` automatisch in ihre JSON-Logs, sodass Grafana von einer Log-Zeile direkt zum zugehörigen verteilten Trace springen kann.

---

## Speicherung von Metriken & Logs (VictoriaMetrics & VictoriaLogs)

* **VictoriaMetrics (`:8428`)**: Performante, speicherschonende Zeitreihendatenbank für System- und Anwendungsmetriken.
* **VictoriaLogs (`:9428`)**: Effiziente Log-Datenbank für die von Vector gesammelten strukturierten JSON-Logs.

### Host-Metriken (node-exporter)

`prom/node-exporter` läuft neben VictoriaMetrics im Netzwerk `observability-internal` und veröffentlicht keine Ports. Er bindet das Host-Root schreibgeschützt ein (`/:/host:ro,rslave`) und aktiviert nur die Collector hinter dem Dashboard-Widget: CPU, Arbeitsspeicher, Root-Dateisystem und Boot-Zeit. VictoriaMetrics fragt ihn alle 15 Sekunden über `-promscrape.config` ab; die Konfiguration liegt in `infrastructure/telemetry/victoriametrics/scrape.yml` (als Release-Asset `victoriametrics-scrape.yml` veröffentlicht, daher aktualisiert sie `alfheim-setup update` mit).

Der Netzwerk-Collector ist bewusst deaktiviert: node-exporter läuft in einem Container mit Bridge-Netzwerk und würde die Schnittstelle des Containers statt der des Hosts melden.

### Telemetrie-Endpunkte für Operatoren

Das Dashboard-Backend liefert `GET /api/v1/telemetry/metrics` und `GET /api/v1/telemetry/logs` nur an Operatoren. Keiner der Endpunkte erfindet Daten:

* **Metriken:** `available: false` bedeutet, dass VictoriaMetrics nicht erreichbar ist. `available: true` mit fehlenden Feldern bedeutet, dass es antwortet, aber noch keine Messwerte dafür hat (zum Beispiel direkt nach dem Start, vor dem ersten Scrape). Das Widget zeigt CPU, Arbeitsspeicher, Root-Datenträger-Auslastung und Host-Betriebszeit aus den node-exporter-Serien.
* **Logs:** `available: false` mit `reason: "unreachable"` bedeutet, dass VictoriaLogs nicht abgefragt werden kann. `available: true` mit leerem `logs`-Array bedeutet, dass es erreichbar ist, aber noch keine Einträge enthält. Die Einträge tragen ihre gespeicherten Zeitstempel.

---

## Visualisierung (Grafana)

Grafana (`http://alfheim.loegien.localhost/grafana/`) liefert vorkonfigurierte Dashboards für CPU-/RAM-Metriken, HTTP-Request-Raten, aktive Zitadel-Sitzungen und Anwendungsfehler-Logs.
