# Infrastructure: Telemetry & Monitoring (VictoriaStack)

This directory defines the central observability platform for Alfheim, replacing legacy ClickHouse/SigNoz with the high-efficiency **VictoriaStack**:
* **`otel-collector`**: Unified OpenTelemetry Collector Contrib ingestion endpoint (`:4317` gRPC / `:4318` HTTP).
* **`victoriametrics`**: High-performance time-series database for Prometheus & OTLP metrics (`:8428`).
* **`victorialogs`**: High-compression log database with LogSQL support (`:9428`).
* **`docker-socket-proxy`**: Read-only allowlist proxy (`wollomatic/socket-proxy`) in front of the Docker socket. Only the GET endpoints Vector needs are reachable, and only from `vector-shipper` on the internal `docker-proxy-net`. Requires `DOCKER_SOCKET_GID` (the host docker group id, `getent group docker | cut -d: -f3`) so the non-root proxy can open the socket.
* **`vector`**: Log harvester normalizing JSON logs and shipping OTLP payloads to `otel-collector`. It reads Docker logs through `docker-socket-proxy` (`docker_host = "tcp://docker-socket-proxy:2375"`), never through the raw socket.
* **`grafana`**: Visualization dashboard provisioned with pre-configured datasources and Zitadel OIDC SSO (`:3000`).

---

## 1. Directory Structure

```
infrastructure/telemetry/
├── compose.yml                          # Telemetry multi-container service definition
├── collector/
│   └── config.yaml                      # OTel Collector receivers, processors, exporters
├── vector/
│   └── vector.toml                      # Vector Docker log extraction & OTLP forwarding
├── victoriametrics/
│   └── scrape.yml                       # Scrape config: VictoriaMetrics pulls node-exporter host metrics
├── grafana/
│   ├── grafana.ini                      # Server subpath & Zitadel generic OAuth settings
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
| **`grafana`** | `grafana:3000` | `http://alfheim.loegien.localhost/grafana` (API alias: `http://api.alfheim.loegien.localhost/grafana`) | Monitoring & Visualization UI |

---

## 3. Grafana Access

* **Primary URL**: `http://alfheim.loegien.localhost/grafana` (API alias: `http://api.alfheim.loegien.localhost/grafana`)
* **Default Admin**: `admin` / `admin`
* **Zitadel SSO**: Client `alfheim-grafana` configured as a generic OAuth provider (`auth_url` on the public `auth.*` host, token and userinfo calls internal to `zitadel:8080`).
