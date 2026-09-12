// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// The portal is merged into the landing page artifact under /docs.
// To serve it from a dedicated domain later (for example docs.loegien.de),
// remove `base` and drop the merge step in .github/workflows/deploy-docs.yml.
export default defineConfig({
  site: 'https://alfheim.loegien.de',
  base: '/docs',
  // The content collection and the changelog wrapper import files from the
  // repository root, which sits above this project's directory.
  vite: {
    server: { fs: { allow: ['../..'] } },
  },
  integrations: [
    starlight({
      title: 'Alfheim',
      description: 'Documentation for Alfheim Sovereign OS.',
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        de: { label: 'Deutsch', lang: 'de' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/KroegerLeif/Alfheim',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      // Shiki ships no grammars for these fences. GitHub highlights them, so the
      // fences stay as they are and are mapped to the closest bundled grammar.
      expressiveCode: {
        shiki: {
          langAlias: {
            caddy: 'nginx',
            caddyfile: 'nginx',
            hosts: 'properties',
            cron: 'properties',
          },
        },
      },
      editLink: {
        baseUrl: 'https://github.com/KroegerLeif/Alfheim/edit/main/docs/',
      },
    }),
  ],
});
