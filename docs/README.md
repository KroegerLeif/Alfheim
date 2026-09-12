# Alfheim Documentation

> **TL;DR:** Source of truth for all Alfheim documentation, structured according to the
> [Diátaxis framework](https://diataxis.fr/). Rendered as a searchable portal at
> **<https://alfheim.loegien.de/docs>**.

---

## 📂 How this directory works

Every Markdown file here is both browsable on GitHub and rendered by the
[Astro Starlight portal](../websites/portal/README.md) in `websites/portal`. There is no copy
step: the portal loads this directory directly through a content collection glob loader.

```
docs/
├── README.md      # this index (not rendered by the portal)
├── 404.md         # portal 404 page
├── en/            # English — default locale and source of truth
└── de/            # German — translated incrementally
```

Pages that exist in `en/` but not yet in `de/` are served automatically from the English
source with a translation notice, so untranslated paths never 404.

**Adding a page:** drop a Markdown file into the right quadrant under `en/`, give it
`title` and `description` frontmatter, and it appears in the portal on the next build.

---

## 📐 The four quadrants

```
                  PRACTICAL STEPS
                     │
    🎓 Tutorials     │    🛠️ How-To Guides
    (Learning-       │    (Task-oriented
     oriented)       │     procedures)
                     │
─────────────────────┼─────────────────────  MOST USEFUL
                     │                       FOR WORK
    💡 Explanation   │    📖 Reference
    (Understanding-  │    (Information-
     oriented)       │     oriented specs)
                     │
                 THEORETICAL
```

---

## 🧭 Contents

### 🎓 Tutorials (learning-oriented)
* [Your First Alfheim Installation](./en/tutorials/first-run.md) — Installing on a fresh Debian or Proxmox host with the interactive installer.
* [Local Getting Started Guide](./en/tutorials/local-getting-started.md) — Running Alfheim locally, step by step.
* [Create a New FDD Microservice](./en/tutorials/create-new-fdd-service.md) — Scaffolding and registering a Feature-Driven Design application.

### 🛠️ How-To Guides (task-oriented)
* [Self-Hosting & Installation Guide](./en/how-to/homelab-deployment.md) — Deploying on Linux bare-metal or Proxmox VE.
* [Wildcard TLS with Hetzner DNS-01](./en/how-to/hetzner-dns-tls.md) — API token and wildcard certificates without inbound port 80.
* [Use Your Own TLS Certificates](./en/how-to/custom-certificates.md) — Bundled directory versus a custom absolute host path.
* [Secrets Hardening & Deployment Readiness](./en/how-to/secrets-hardening.md) — Sourcing secrets, AES encryption keys, environment overrides.
* [Backup, Restore & Data Migration](./en/how-to/backup-restore.md) — PostgreSQL databases, RustFS S3 object storage, and volumes.
* [Platform Troubleshooting & Operations](./en/how-to/troubleshooting.md) — Container boot races, migration locks, and gateway errors.

### 📖 Reference (information-oriented)
* [Application Catalog](./en/reference/apps-catalog.md) — Tier-1 core apps and Tier-2 stack integrations.
* [Caddy Gateway Ingress & Routing Matrix](./en/reference/ingress-matrix.md) — Public URLs, internal ports, path stripping.
* [Environment Variables Reference](./en/reference/environment-variables.md) — Every `.env` configuration flag.
* [Installer CLI Reference](./en/reference/installer-cli.md) — Every flag, environment variable and exit code of `alfheim-setup`.
* [CLI Scripts Reference](./en/reference/cli-scripts.md) — Flags for `up.sh`, `down.sh`, `seed.sh`, and `verify.sh`.

### 💡 Explanation (understanding-oriented)
* [Platform Architecture Overview](./en/explanation/architecture-overview.md) — Multi-zone networks, control plane, container topology.
* [Feature-Driven Design (FDD) Paradigm](./en/explanation/feature-driven-design.md) — Bounded contexts, the 6-file feature structure, 200 LOC limits.
* [Authentication & Multi-Tenancy](./en/explanation/authentication-security.md) — Zitadel OIDC, JWT claim validation, `X-Household-ID` isolation.
* [VictoriaStack Telemetry Pipeline](./en/explanation/telemetry-pipeline.md) — Vector log aggregation, OTel Collector, W3C traceparent headers.
* [Known Issues & System Trade-Offs](./en/explanation/known-issues.md) — Accepted costs and their mitigations.

### 🏛️ Architectural Decision Records
Recorded in [MADR format](https://adr.github.io/madr/) under [`en/explanation/decisions/`](./en/explanation/decisions/README.md):
* [ADR 0001: Adoption of Diátaxis Documentation Framework](./en/explanation/decisions/0001-diataxis-documentation.md)
* [ADR 0002: Feature-Driven Design & Bounded Context Monorepo](./en/explanation/decisions/0002-feature-driven-design.md)
* [ADR 0003: Migration from Keycloak to Zitadel](./en/explanation/decisions/0003-migrate-from-keycloak-to-zitadel.md)
* [ADR 0004: Standalone Interactive Installer as a Typed Go TUI](./en/explanation/decisions/0004-standalone-go-tui-installer.md)
* [ADR 0005: Astro Starlight Documentation Portal with i18n](./en/explanation/decisions/0005-starlight-docs-portal.md)

---

## 📝 Changelog

The portal renders the root [`CHANGELOG.md`](../CHANGELOG.md) directly. Edit that file;
never maintain a second copy here.
