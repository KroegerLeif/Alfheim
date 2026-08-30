# Websites Architecture

The `websites/` directory contains public-facing web applications, documentation portals, and static marketing or project websites for `alfheim`.

---

## 1. Architectural Purpose

While `apps/` and `core/` contain platform micro-applications requiring authentication and backend microservices, `websites/` hosts standalone client-side applications, such as public documentation portals and project landing pages.

The primary project currently in `websites/` is:
* **`docs/`**: Public platform documentation web site (`https://loegien.github.io/alfheim/`), presenting architectural overviews, interactive application grids, technology stack summaries, and multi-language documentation.

---

## 2. Directory Structure & Tech Stack

```
websites/
└── docs/                   # Public Documentation Website
    ├── src/
    │   ├── components/    # Page sections (AppsGrid, ArchitectureSection, TechStackSection)
    │   ├── i18n/          # Locales (en.json, de.json, pl.json) and translation helpers
    │   └── main.tsx
    ├── package.json        # Dependencies (React, Vite, Lucide-React, Tailwind CSS)
    └── vite.config.ts
```

### Tech Stack & Features:
* **Framework**: React 18 + Vite for fast build and Static Site Generation (SSG) / Single Page Application (SPA) delivery.
* **Styling**: Tailwind CSS for responsive, modern UI design.
* **Internationalization**: Lightweight client-side i18n supporting English (`en`), German (`de`), and Polish (`pl`).
* **Deployment Workflow**: Automated GitHub Actions workflow (`.github/workflows/deploy-docs.yml`) builds and deploys static artifacts to GitHub Pages on pushes to `main`.

---

## 3. Interactions with Other Layers

* **Platform Documentation**: Translates architecture definitions from `README.md`, `compose.yaml`, and `deploy/stack-apps.yaml` into interactive visual documentation for external developers and users.
* **CI/CD Integration**: Static assets built from `websites/docs` are automatically published to GitHub Pages without requiring live container infrastructure or backend database connections.
