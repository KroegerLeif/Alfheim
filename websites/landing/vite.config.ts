import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { readFileSync } from 'fs';

/**
 * Returns the latest released version from the root CHANGELOG.md, for example `v0.5.0`.
 *
 * The changelog is the release record: a release moves `[Unreleased]` under a new
 * `## [vX.Y.Z]` heading, so its first such heading is what users can install. The root
 * package.json carries no version and versions.json pins toolchains, and git tags are
 * missing from the shallow CI checkout. The build fails instead of showing a made-up badge.
 */
function latestRelease(): string {
  const changelog = readFileSync(path.resolve(__dirname, '../../CHANGELOG.md'), 'utf8');
  const match = changelog.match(/^## \[(v\d+\.\d+\.\d+[^\]]*)\]/m);
  if (!match) {
    throw new Error('CHANGELOG.md has no released "## [vX.Y.Z]" heading');
  }
  return match[1];
}

export default defineConfig({
  base: './',
  define: {
    __ALFHEIM_RELEASE__: JSON.stringify(latestRelease()),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@alfheim/shared/assets': path.resolve(__dirname, '../../packages/shared/src/assets'),
      '@alfheim/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
