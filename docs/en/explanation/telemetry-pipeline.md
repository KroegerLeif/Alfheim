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

Vector (`infrastructure/telemetry/vector/vector.toml`) harvests container logs through a read-only Docker socket proxy (`docker-socket-proxy`, `wollomatic/socket-proxy`). Vector never mounts `/var/run/docker.sock` itself, because access to the Docker API is equivalent to root on the host, even when mounted `:ro`.

The proxy holds the socket and forwards only the GET endpoints the `docker_logs` source needs (version, ping, info, events, container list, inspect, and logs). Every other request is denied, including all POST/PUT/DELETE calls and the container file-archive endpoint. It sits on the internal-only `docker-proxy-net` network, which only Vector can reach and which has no route out of the host.

Key Vector features:
* **Multiline Stack Trace Aggregation:** Merges multiline Python tracebacks and Go panic traces (`\tat`, `\tgoroutine`) into single logical log events.
* **Field Normalization:** Maps heterogeneous log fields (`msg` $\rightarrow$ `message`) and standardizes severity levels (`WARN` / `WARNING` $\rightarrow$ `warn`, `ERROR` $\rightarrow$ `error`).
* **Ingestion:** Ships batches straight to VictoriaLogs' JSON lines API (`/insert/jsonline`), with `service_name` (the container name) as the stream field. It does not go through the OTel Collector, whose `/v1/logs` endpoint only accepts OTLP payloads.
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

### Host metrics (node-exporter)

`prom/node-exporter` runs next to VictoriaMetrics on `observability-internal` and publishes no ports. It mounts the host root read-only (`/:/host:ro,rslave`) and only enables the collectors behind the dashboard widget: CPU, memory, root filesystem, and boot time. VictoriaMetrics pulls it every 15 seconds through `-promscrape.config`, which points at `infrastructure/telemetry/victoriametrics/scrape.yml` (published as the `victoriametrics-scrape.yml` release asset, so `alfheim-setup update` refreshes it).

The network collector is disabled on purpose: node-exporter runs in a bridge-networked container, so it would report the container's own interface rather than the host's.

### Operator telemetry endpoints

The dashboard backend serves `GET /api/v1/telemetry/metrics` and `GET /api/v1/telemetry/logs` to operators only. Neither endpoint ever invents data:

* **Metrics:** `available: false` means VictoriaMetrics cannot be reached. `available: true` with missing fields means it answered but holds no samples for them yet (for example right after a start, before the first scrape). The widget shows CPU, memory, root-disk usage and host uptime from the node-exporter series.
* **Logs:** `available: false` with `reason: "unreachable"` means VictoriaLogs cannot be queried. `available: true` with an empty `logs` array means it is reachable but holds no entries yet. Entries carry their stored timestamps.

---

## Visualization (Grafana)

Grafana (`http://alfheim.loegien.localhost/grafana/`) provides pre-configured dashboards for system CPU/RAM metrics, HTTP request rates, active Zitadel sessions, and application error logs.
