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

Vector (`infrastructure/telemetry/vector/vector.toml`) sammelt Container-Logs direkt vom Docker-Socket.

Wesentliche Funktionen:
* **Zusammenführung mehrzeiliger Stacktraces:** Fasst mehrzeilige Python-Tracebacks und Go-Panic-Traces (`\tat`, `\tgoroutine`) zu einem logischen Log-Ereignis zusammen.
* **Feld-Normalisierung:** Vereinheitlicht heterogene Log-Felder (`msg` → `message`) und Schweregrade (`WARN` / `WARNING` → `warn`, `ERROR` → `error`).
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

---

## Visualisierung (Grafana)

Grafana (`http://alfheim.loegien.localhost/grafana/`) liefert vorkonfigurierte Dashboards für CPU-/RAM-Metriken, HTTP-Request-Raten, aktive Zitadel-Sitzungen und Anwendungsfehler-Logs.
