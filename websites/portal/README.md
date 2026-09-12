# Alfheim Documentation Portal (`websites/portal`)

Astro Starlight site that renders the Diátaxis documentation corpus from the
repository-root [`docs/`](../../docs/README.md) directory. Deployed under `/docs`
on GitHub Pages, alongside the [landing page](../landing/README.md) at the site root.

---

## 1. Why the content lives elsewhere

This package holds the build toolchain only. The Markdown stays at the repository
root so it remains browsable on GitHub and is the single source of truth.
`src/content.config.ts` replaces Starlight's `docsLoader()` — which is hardcoded to
`src/content/docs/` — with a glob loader based at `../../docs`.

Starlight derives the locale from the leading path segment of the entry ID, so
`docs/en/tutorials/first-run.md` resolves to the `en` locale.

---

## 2. Internationalization

* **`en`** — default locale and source of truth.
* **`de`** — translated incrementally.

Pages missing from `de/` are generated from the English source with a translation
notice, so untranslated paths never return 404.

---

## 3. Local development

```bash
# From the workspace root
pnpm --filter @alfheim/docs-portal dev     # http://localhost:4321/docs/

# Production build
pnpm --filter @alfheim/docs-portal build   # -> websites/portal/dist/
```

Requires Node >= 22.12 (Astro 7).

---

## 4. Deployment

`.github/workflows/deploy-docs.yml` builds the landing page, builds this portal,
copies `websites/portal/dist/` into `websites/landing/dist/docs/`, and uploads a
single GitHub Pages artifact.

Search is provided by [Pagefind](https://pagefind.app/), generated at build time
and fully static — no API, no rate limits.

**Moving to a dedicated domain** (for example `docs.loegien.de`) means removing
`base: '/docs'` from `astro.config.mjs` and dropping the merge step in the workflow.
