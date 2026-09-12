# Infrastructure Services

This directory contains the foundational platform infrastructure for `alfheim`:
the ingress gateway, the core database cluster, object storage and the
observability stack. Identity is provided by Zitadel, which is defined directly
in `compose.prod.yaml` rather than in a subdirectory here.

---

## 1. Services

| Service | Location | Purpose |
| :--- | :--- | :--- |
| `caddy` | [`caddy/`](./caddy/README.md) | Central reverse proxy and ingress gateway. Terminates TLS and routes the frontend, IAM and API domains. |
| `postgres-core` | [`postgres/`](./postgres/README.md) | Shared PostgreSQL 16 cluster. Hosts one isolated database per service, each owned by a dedicated least-privilege user. |
| `rustfs` | [`rustfs/`](./rustfs/README.md) | S3-compatible object storage for attachments and presigned uploads. |
| VictoriaStack | [`telemetry/`](./telemetry/README.md) | Vector, OpenTelemetry Collector, VictoriaMetrics, VictoriaLogs and Grafana. |
| `zitadel` | `compose.prod.yaml` | Central OIDC identity provider. Served on its own `auth.*` host; stores state in the `zitadel` database on `postgres-core`. |

---

## 2. Database Topology

The platform follows a "database per service" model inside a single shared
PostgreSQL cluster. Blast radius is limited by ownership and grants rather than
by separate database servers, which keeps the memory footprint viable on
homelab hardware.

Databases are provisioned on first boot by
[`postgres/init-multiple-dbs.sh`](./postgres/init-multiple-dbs.sh); see
[`postgres/README.md`](./postgres/README.md) for the full matrix.

---

## 3. Prerequisites

* Docker and Docker Compose v2.
* A populated root `.env`. Generate one from the template with:

```bash
cp .env.example .env
./scripts/init-env.sh
```

---

## 4. Related Documentation

* [Platform Architecture Overview](../docs/explanation/architecture-overview.md)
* [Caddy Ingress Routing Matrix](../docs/reference/ingress-matrix.md)
* [Environment Variables Reference](../docs/reference/environment-variables.md)
