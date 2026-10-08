# Alfheim Documentation Portal (`websites/portal`)

Astro Starlight site that renders the Diátaxis documentation corpus from the
repository-root [`docs/`](../../docs/README.md) directory. Deployed under `/docs`
on GitHub Pages, alongside the [landing page](../landing/README.md) at the site root.

---

## 1. Why the content lives elsewhere

This package holds the build toolchain only. The Markdown stays at the repository
root so it remains browsable on GitHub and is the single source of truth.
`src/content/docs` is a symlink to `../../../../docs`, and `src/content.config.ts`
replaces Starlight's `docsLoader()` with a glob loader based at that path. Starlight
resolves sidebar `autogenerate` groups against `src/content/docs`, so the symlink
(instead of a loader based at `../../docs`) is what keeps the sidebar populated.

Documentation pages link to each other with relative `.md` paths so they stay
navigable on GitHub. `src/plugins/rewrite-doc-links.mjs` (a Sätteri mdast plugin)
rewrites those to portal URLs at build time, and turns relative links to files
outside `docs/` (for example `deploy/stack-apps.yaml`) into GitHub URLs.

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

Crawl the merged Pages artifact for broken links, anchors, assets, orphan pages and
empty pages (build the landing page and the portal first):

```bash
pnpm --filter @alfheim/landing build
pnpm --filter @alfheim/docs-portal build
python3 scripts/check-docs-site.py
```

---

## 4. Deployment

`.github/workflows/deploy-docs.yml` builds the landing page, builds this portal,
copies `websites/portal/dist/` into `websites/landing/dist/docs/`, and uploads a
single GitHub Pages artifact.

Search is provided by [Pagefind](https://pagefind.app/), generated at build time
and fully static — no API, no rate limits.

**Moving to a dedicated domain** (for example `docs.loegien.de`) means removing
`base: '/docs'` from `astro.config.mjs` and dropping the merge step in the workflow.
