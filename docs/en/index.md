---
title: Alfheim Documentation
description: Central knowledge base for Alfheim Sovereign OS, structured according to the Diataxis framework.
template: splash
hero:
  tagline: A local-first household OS that runs on your own hardware, from a small Lean Core up to every optional app.
  actions:
    - text: First run tutorial
      link: /docs/en/tutorials/first-run/
      icon: right-arrow
    - text: View on GitHub
      link: https://github.com/KroegerLeif/Alfheim
      icon: external
      variant: minimal
---

Alfheim is a local-first household OS: pantry, shopping lists, budget, chores and the other apps
run on a server in your own home, behind your own sign-in. A default install is the **Lean Core**
(Caddy, PostgreSQL, Zitadel, RustFS, the dashboard and the household app), which reserves about
752 MB of RAM and fits a 2 GB host. Every other app is an optional module that you switch on with
`alfheim-setup apps enable <name>` when the household needs it. Why the core is drawn there is
recorded in [ADR 0007](explanation/decisions/0007-lean-core-app-set.md); the hardware tiers are in
the [self-hosting guide](how-to/homelab-deployment.md#hardware-specifications).

For a short tour of the modules, the planned integrations and the roadmap, see the
[project overview](https://docs.alfheim.loegien.de/).

## Find your way

Documentation is split into four modes, following the [Diataxis framework](https://diataxis.fr/).

- **Tutorials** — learning-oriented walkthroughs for getting Alfheim running.
- **How-to guides** — task-oriented recipes for operators and developers.
- **Reference** — technical specifications, catalogs and CLI flags.
- **Explanation** — architecture, design philosophy and decision records.
