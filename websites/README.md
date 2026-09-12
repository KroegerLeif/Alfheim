# Websites Architecture

The `websites/` directory contains public-facing web applications, documentation portals, and static marketing or project websites for `alfheim`.

---

## 1. Architectural Purpose

While `apps/` and `core/` contain platform micro-applications requiring authentication and backend microservices, `websites/` hosts standalone client-side applications, such as public documentation portals and project landing pages.

The projects in `websites/` are:
* **`landing/`**: Public marketing landing page served at the site root (`https://alfheim.loegien.de/`), presenting architectural overviews, interactive application grids, and technology stack summaries.
* **`portal/`**: Astro Starlight documentation portal served under `/docs`, rendering the Diataxis corpus from the repository-root `docs/` directory.

---

## 2. Directory Structure & Tech Stack

```
websites/
├── landing/                # Public marketing landing page (served at /)
│   ├── src/
│   │   ├── components/    # Page sections (AppsGrid, ArchitectureSection, TechStackSection)
│   │   ├── i18n/          # Translation helpers consuming @alfheim/shared locales
│   │   └── main.tsx
│   ├── package.json        # Dependencies (React, Vite, Lucide-React, Tailwind CSS)
│   └── vite.config.ts
└── portal/                 # Astro Starlight documentation portal (served at /docs)
    ├── astro.config.mjs    # base, locales and Diataxis sidebar
    └── src/content.config.ts  # glob loader pointing at the repo-root docs/ tree
```

### Tech Stack & Features:
* **Framework**: React 19 + Vite for fast build and Static Site Generation (SSG) / Single Page Application (SPA) delivery.
* **Styling**: Tailwind CSS for responsive, modern UI design.
* **Internationalization**: The landing page uses lightweight client-side i18n supporting English (`en`), German (`de`), and Polish (`pl`). The documentation portal ships English and German.
* **Deployment Workflow**: A single GitHub Actions workflow (`.github/workflows/deploy-docs.yml`) builds both projects, merges the portal into the landing artifact under `/docs`, and deploys to GitHub Pages on pushes to `main`. The Pages site uses the custom domain `alfheim.loegien.de`.

---

## 3. Interactions with Other Layers

* **Platform Documentation**: The portal renders the repository-root `docs/` corpus directly, so Markdown stays browsable on GitHub and is the single source of truth.
* **CI/CD Integration**: Static assets are published to GitHub Pages without requiring live container infrastructure or backend database connections.
