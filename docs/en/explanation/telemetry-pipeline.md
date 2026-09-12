---
title: "VictoriaStack Telemetry Pipeline"
description: "The central observability pipeline: Vector log harvesting, OTel Collector metrics and trace routing, VictoriaMetrics, VictoriaLogs and Grafana."
---

> **TL;DR:** Architectural explanation of the central observability pipeline, covering Vector log harvesting, OTel Collector metrics/traces routing, VictoriaMetrics, VictoriaLogs, and Grafana visualization.

---

## 📋 Table of Contents
- [Observability Stack Architecture](#observability-stack-architecture)
- [Log Harvesting & Normalization (Vector)](#log-harvesting--normalization-vector)
- [OpenTelemetry Tracing & W3C Traceparent Headers](#opentelemetry-tracing--w3c-traceparent-headers)
- [Metrics & Logs Storage (VictoriaMetrics & VictoriaLogs)](#metrics--logs-storage-victoriametrics--victorialogs)
- [Visualization (Grafana)](#visualization-grafana)

---

## Observability Stack Architecture

Alfheim implements a unified telemetry architecture based on **VictoriaStack** under `infrastructure/telemetry`:

```
┌─────────────────┐       ┌─────────────────┐
│ App Backends    │       │ Docker Socket   │
│ (Go & FastAPI)  │       │ (Stdout/Stderr) │
└────────┬────────┘       └────────┬────────┘
         │ OTLP Traces             │ Plaintext/JSON Logs
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│ OTel Collector  │       │ Vector          │
│ (Port 4317)     │       │ (Log Harvester) │
└────────┬────────┘       └────────┬────────┘
         │ Traces/Metrics          │ Structured Logs
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

## Log Harvesting & Normalization (Vector)

Vector (`infrastructure/telemetry/vector/vector.toml`) harvests container logs directly from the Docker socket.

Key Vector features:
* **Multiline Stack Trace Aggregation:** Merges multiline Python tracebacks and Go panic traces (`\tat`, `\tgoroutine`) into single logical log events.
* **Field Normalization:** Maps heterogeneous log fields (`msg` $\rightarrow$ `message`) and standardizes severity levels (`WARN` / `WARNING` $\rightarrow$ `warn`, `ERROR` $\rightarrow$ `error`).
* **Health Endpoint:** Exposes internal diagnostic health checks on `http://127.0.0.1:8686/health`.

---

## OpenTelemetry Tracing & W3C Traceparent Headers

Distributed request tracing across microservices uses W3C `traceparent` context propagation:

1. **Header Generation**: `@alfheim/shared` generates W3C traceparent headers (`00-<trace_id>-<span_id>-01`) on outgoing frontend API calls (`fetchWithTrace`, `ApiClient`).
2. **Context Extraction**: Go and Python backends extract the trace context in HTTP middleware.
3. **Structured Log Injection**: Backends automatically inject `trace_id` and `span_id` attributes into JSON log messages, allowing Grafana to jump from a log line directly to its corresponding distributed trace.

---

## Metrics & Logs Storage (VictoriaMetrics & VictoriaLogs)

* **VictoriaMetrics (`:8428`)**: High-performance, low-memory time-series database storing system and application metrics.
* **VictoriaLogs (`:9428`)**: High-efficiency log database storing structured JSON logs harvested by Vector.

---

## Visualization (Grafana)

Grafana (`http://alfheim.loegien.localhost/grafana/`) provides pre-configured dashboards for system CPU/RAM metrics, HTTP request rates, active Zitadel sessions, and application error logs.
