---
title: "Known Issues & System Trade-Offs"
description: "Central register of accepted architectural trade-offs, environmental limitations and known operational costs. Software bugs belong in the issue tracker."
sidebar:
  label: "Known Issues"
---

> **TL;DR:** Central register of accepted architectural trade-offs, environmental limitations, and known operational costs in the Alfheim ecosystem. Software bugs belong in the repository Issue Tracker.

---

## 📋 Accepted Costs & Environmental Trade-Offs

| Subsystem | Symptom / Behavior | Root Cause & Accepted Cost | Workaround / Operational Mitigation |
| :--- | :--- | :--- | :--- |
| **Caddy / macOS** | Loopback DNS resolution fails for `.localhost` subdomains after macOS sleep | macOS Docker Desktop bridge loopback isolation issue | Execute `docker exec -it alfheim_caddy caddy reload --config /etc/caddy/Caddyfile` |
| **Caddy / `internal` TLS** | Browsers show a certificate warning for every Alfheim host, including the LAN `.localhost` preset | Sign-in needs HTTPS (Web Crypto is only available in a secure context), so the `internal` strategy serves HTTPS signed by a private root CA the installer generates. No browser trusts that root by default | Import `infrastructure/ca/alfheim-root-ca.crt` once per device, after checking its fingerprint. See [Trust the local root CA](../how-to/trust-local-root-ca.md) |
| **Browser / `internal` TLS** | Accepting the warning only for the app host leaves sign-in failing with *Sign-in service not reachable* | Browsers store certificate exceptions per host and never show an interstitial for background requests, so the discovery request to the auth host is rejected silently | Import the root CA, or open and accept the warning for **both** the app host and the auth host before signing in |
| **Telemetry / Vector** | 100ms latency buffer on structured log delivery to VictoriaLogs | Async OTLP micro-batching window configured in Vector to minimize container CPU overhead | Real-time unbuffered container logs remain instantly accessible via `docker logs <container>` |
| **Python Workspaces** | Microservices require `context: ../..` build root in Docker Compose | `uv` workspace dependency resolution requires access to root `pyproject.toml` and workspace packages (`packages/backend-shared`) | Docker build context is set to monorepo root in compose files |
