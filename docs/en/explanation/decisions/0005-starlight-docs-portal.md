---
title: "ADR 0005: Astro Starlight Documentation Portal with i18n"
sidebar:
  label: "0005 Starlight Portal"
---

* Status: accepted
* Deciders: Alfheim Core Architecture Team
* Date: 2026-09-12

Technical Story: [#354](https://github.com/KroegerLeif/Alfheim/issues/354)

---

## Context and Problem Statement

[ADR 0001](./0001-diataxis-documentation.md) established the Diátaxis structure
under `docs/`, but the result was a plain directory of Markdown files. It had no
full-text search, no navigation beyond a hand-maintained index, and no path to a
second language. As the corpus grew past two dozen documents, finding anything
required either knowing the filename or reading the index top to bottom.

Separately, the nine application READMEs each mixed all four Diátaxis modes in
one file, so the specification content was invisible to anyone not already
browsing that directory.

## Decision Drivers

* **Search.** Offline full-text search over the whole corpus, with no API and no
  rate limits.
* **Toolchain alignment.** The repository is a TypeScript monorepo; adding a
  Python runtime to the docs build step was not acceptable.
* **Single source of truth.** Markdown must stay browsable on GitHub. A build
  step that copies content into a second location would drift.
* **Incremental translation.** German pages must be addable one at a time
  without leaving 404s behind for the ones not yet written.

## Considered Options

* **Option 1: Astro Starlight** — TypeScript-native SSG with built-in Pagefind
  search and first-class i18n fallback.
* **Option 2: MkDocs Material** — mature and feature-rich, but introduces Python
  into the CI docs build.
* **Option 3: Docusaurus** — React-based, but heavier at runtime and its i18n
  model is built around translation files rather than parallel content trees.
* **Option 4: Keep plain Markdown** — zero build cost, but none of the drivers
  are met.

## Decision Outcome

Chosen option: **Astro Starlight**, in a dedicated `websites/portal` package.

Three decisions are worth recording beyond the engine choice:

**The content stays at the repository root.** Starlight's `docsLoader()` is
hardcoded to `src/content/docs/`. Rather than move 24 files into the Astro
package, `src/content.config.ts` uses a glob loader based at `../../docs`. The
Markdown therefore stays browsable on GitHub and remains the single source of
truth, while the Astro package holds only the build toolchain.

**English is the default locale.** The existing corpus was already English, and
`.ai/rules/core.md` mandates English for code and commits. Starlight's fallback
is asymmetric — missing pages are generated from the default locale — so making
German the default would have required translating all 24 documents up front and
would have made German the language every future change starts in.

**App READMEs are split, not moved.** The specification half of each README
moves to `docs/en/reference/apps/<app>.md`; the dev quickstart stays in
`apps/<app>/README.md`. Renaming the READMEs to `<app>.md` was rejected: GitHub
auto-renders `README.md` in a directory listing, so renaming would have reduced
discoverability rather than improving it. Moving them entirely was also
rejected: someone working inside `apps/<app>/` needs the dev commands there.

### Consequences

* Good, because Pagefind gives offline full-text search with no runtime service.
* Good, because the docs build reuses the existing pnpm and Node toolchain.
* Good, because untranslated German paths serve English content with a notice
  instead of 404ing, so translation can proceed page by page.
* Bad, because the docs build now requires Node >= 22.12, which forced the Pages
  workflow from Node 20 to 22.
* Bad, because the portal and the landing page are two build steps merged by the
  workflow, which is more moving parts than a single site.

## Pros and Cons of the Options

### Option 2: MkDocs Material

* Good, because it is mature with a large plugin ecosystem.
* Bad, because it requires Python in the CI docs build, which ADR 0004 already
  worked to remove from the installer path.

### Option 3: Docusaurus

* Good, because it is widely adopted and React-based like the rest of the stack.
* Bad, because it ships considerably more runtime JavaScript for a static docs site.
* Bad, because its i18n model centres on extracted translation files rather than
  parallel content trees, which fits a UI better than a document corpus.

---

## Links

* [ADR 0001: Adoption of Diátaxis Documentation Framework](./0001-diataxis-documentation.md)
* [Portal package README](../../../../websites/portal/README.md)
