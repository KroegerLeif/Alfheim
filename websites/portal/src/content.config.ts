import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { i18nLoader } from '@astrojs/starlight/loaders';

// The documentation corpus lives at the repository root in `docs/`, not inside
// this Astro project. Keeping it there means the Markdown stays browsable on
// GitHub and remains the single source of truth, while this package holds only
// the build toolchain.
//
// Starlight derives the locale from the leading path segment of the entry ID,
// so `docs/en/tutorials/first-run.md` resolves to the `en` locale. `docs/README.md`
// is deliberately outside the pattern and stays a plain GitHub index page.
export const collections = {
  docs: defineCollection({
    loader: glob({
      base: '../../docs',
      // The 404 entry must sit at the collection root: Starlight looks it up by
      // the bare ID `404`, outside the locale tree.
      pattern: ['{en,de}/**/[^_]*.{md,mdx}', '404.{md,mdx}'],
    }),
    schema: docsSchema(),
  }),
  // Overrides for Starlight's built-in UI strings. Starlight ships English and
  // German translations already, so this collection is normally empty.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
