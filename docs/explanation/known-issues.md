# Central Known Issues & System Trade-Offs

> **TL;DR:** Central register of accepted architectural trade-offs, environmental limitations, and known operational costs in the Alfheim ecosystem. Software bugs belong in the repository Issue Tracker.

---

## 📋 Accepted Costs & Environmental Trade-Offs

| Subsystem | Symptom / Behavior | Root Cause & Accepted Cost | Workaround / Operational Mitigation |
| :--- | :--- | :--- | :--- |
| **Caddy / macOS** | Loopback DNS resolution fails for `.localhost` subdomains after macOS sleep | macOS Docker Desktop bridge loopback isolation issue | Execute `docker exec -it alfheim_caddy caddy reload --config /etc/caddy/Caddyfile` |
| **Telemetry / Vector** | 100ms latency buffer on structured log delivery to VictoriaLogs | Async OTLP micro-batching window configured in Vector to minimize container CPU overhead | Real-time unbuffered container logs remain instantly accessible via `docker logs <container>` |
| **Python Workspaces** | Microservices require `context: ../..` build root in Docker Compose | `uv` workspace dependency resolution requires access to root `pyproject.toml` and workspace packages (`packages/backend-shared`) | Docker build context is set to monorepo root in compose files |
