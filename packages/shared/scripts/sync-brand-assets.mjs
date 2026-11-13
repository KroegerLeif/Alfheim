#!/usr/bin/env node
/**
 * Copies the canonical favicon bundle from `src/assets/favicon_io/` into a frontend's
 * `public/` directory. Frontends call it from `predev`/`prebuild` so the bundle lives in
 * exactly one place in git; the copies are build output and ignored by `.gitignore`.
 *
 * Usage: node <path-to>/packages/shared/scripts/sync-brand-assets.mjs [targetDir]
 * `targetDir` defaults to `public` relative to the current working directory.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/assets/favicon_io');
const targetDir = resolve(process.cwd(), process.argv[2] ?? 'public');

mkdirSync(targetDir, { recursive: true });
const files = readdirSync(sourceDir).filter((name) => !name.startsWith('.'));
if (files.length === 0) {
  throw new Error(`No favicon files found in ${sourceDir}`);
}
for (const name of files) {
  copyFileSync(join(sourceDir, name), join(targetDir, name));
}
console.log(`Synced ${files.length} brand asset files into ${targetDir}`);
