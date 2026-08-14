# Infrastructure: Telemetry & Monitoring (VictoriaStack)

This directory defines the central observability platform for Alfheim, replacing legacy ClickHouse/SigNoz with the high-efficiency **VictoriaStack**:
* **`otel-collector`**: Unified OpenTelemetry Collector Contrib ingestion endpoint (`:4317` gRPC / `:4318` HTTP).
* **`victoriametrics`**: High-performance time-series database for Prometheus & OTLP metrics (`:8428`).
* **`victorialogs`**: High-compression log database with LogSQL support (`:9428`).
* **`vector`**: Docker socket log harvester normalizing JSON logs and shipping OTLP payloads to `otel-collector`.
* **`grafana`**: Visualization dashboard provisioned with pre-configured datasources and Keycloak OIDC SSO (`:3000`).

---

## 1. Directory Structure

```
infrastructure/telemetry/
├── compose.yml                          # Telemetry multi-container service definition
├── collector/
│   └── config.yaml                      # OTel Collector receivers, processors, exporters
├── vector/
│   └── vector.toml                      # Vector Docker log extraction & OTLP forwarding
├── grafana/
│   ├── grafana.ini                      # Server subpath & Keycloak generic OAuth settings
│   └── provisioning/
│       ├── datasources/
│       │   └── datasources.yaml         # VictoriaMetrics & VictoriaLogs datasources
│       └── dashboards/
│           ├── dashboards.yaml          # Dashboard provisioning providers
│           └── alfheim-overview.json    # Platform health starter dashboard
└── README.md
```

---

## 2. Ports & Internal Routing

| Service | Internal Host / Port | Ingress Route (Caddy Gateway) | Purpose |
| :--- | :--- | :--- | :--- |
| **`otel-collector`** | `otel-collector:4317` (gRPC), `otel-collector:4318` (HTTP) | N/A (Internal `observability-internal`) | Unified OTLP telemetry ingestion |
| **`victoriametrics`** | `victoriametrics:8428` | N/A (Internal `observability-internal`) | PromQL / Metrics time-series engine |
| **`victorialogs`** | `victorialogs:9428` | N/A (Internal `observability-internal`) | LogSQL / Log analytics engine |
| **`grafana`** | `grafana:3000` | `http://api.alfheim.loegien.localhost/grafana` | Monitoring & Visualization UI |

---

## 3. Grafana Access

* **URL**: `http://api.alfheim.loegien.localhost/grafana` (or `http://alfheim.loegien.localhost/grafana`)
* **Default Admin**: `admin` / `admin`
* **Keycloak SSO**: Client `alfheim-grafana` under realm `alfheim` (generic OAuth).
