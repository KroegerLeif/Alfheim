/**
 * Static i18n helpers for tests: load the locale JSON files, flatten them to dotted keys,
 * and extract literal keys passed to the shared `t()` from source files.
 */
import fs from 'node:fs';
import path from 'node:path';

export const LANGUAGES = ['en', 'de', 'pl'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const SHARED_SRC = path.resolve(__dirname, '..');
export const WORKSPACE_ROOT = path.resolve(SHARED_SRC, '../../..');
export const LOCALES_DIR = path.join(SHARED_SRC, 'features/i18n/locales');

type Json = { [key: string]: Json | string };

/** Flattens a nested dictionary into `dotted.key -> string` entries. */
export function flatten(obj: Json, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else flatten(value, full, out);
  }
  return out;
}

export function namespaceFiles(): string[] {
  return fs.readdirSync(path.join(LOCALES_DIR, 'en')).filter((f) => f.endsWith('.json')).sort();
}

export function loadNamespace(lang: Lang, file: string): Record<string, string> {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, lang, file), 'utf8');
  return flatten(JSON.parse(raw) as Json);
}

/** Merged flat dictionary for one language, mirroring the deep merge in `locales.ts`. */
export function loadLanguage(lang: Lang): Record<string, string> {
  return Object.assign({}, ...namespaceFiles().map((f) => loadNamespace(lang, f)));
}

const SOURCE_EXT = /\.(tsx?|jsx?)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', 'tests', '__tests__']);

export function listSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, acc);
    else if (SOURCE_EXT.test(entry.name) && !/\.test\./.test(entry.name)) acc.push(full);
  }
  return acc;
}

export interface KeyUsage {
  file: string;
  line: number;
  key: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Returns the literal keys passed to the shared translation function in `source`.
 *
 * Only files that import `useTranslation` from `@alfheim/shared` (or, inside the shared package,
 * from its own i18n module) are considered, and only the function destructured from that hook
 * (`const { t } = useTranslation()` or `const { t: tShared } = ...`). This keeps next-intl
 * `useTranslations()` callers, which resolve keys relative to a namespace, out of the check.
 */
export function extractSharedKeys(source: string, file: string): KeyUsage[] {
  const importRe =
    /import\s*\{([^}]*)\}\s*from\s*['"](@alfheim\/shared|(?:\.{1,2}\/)+(?:[\w-]+\/)*(?:i18n|i18n\/utils|useTranslation)(?:\/[\w-]+)*)['"]/g;
  const hookNames = new Set<string>();
  for (const match of source.matchAll(importRe)) {
    for (const spec of match[1].split(',')) {
      const m = spec.trim().match(/^useTranslation(?:\s+as\s+(\w+))?$/);
      if (m) hookNames.add(m[1] ?? 'useTranslation');
    }
  }
  if (hookNames.size === 0) return [];

  const fnNames = new Set<string>();
  for (const hook of hookNames) {
    const destructure = new RegExp(`\\{([^{}]*)\\}\\s*=\\s*${escape(hook)}\\(\\)`, 'g');
    for (const match of source.matchAll(destructure)) {
      const m = match[1].match(/(?:^|,)\s*t(?:\s*:\s*(\w+))?\s*(?:,|$)/);
      if (m) fnNames.add(m[1] ?? 't');
    }
  }

  const usages: KeyUsage[] = [];
  for (const fn of fnNames) {
    const call = new RegExp(`(?<![\\w.])${escape(fn)}\\(\\s*(['"\`])([^'"\`$]+)\\1`, 'g');
    for (const match of source.matchAll(call)) {
      const line = source.slice(0, match.index).split('\n').length;
      usages.push({ file, line, key: match[2] });
    }
  }
  return usages;
}

/** Frontend source roots that consume the shared dictionaries through `useTranslation`. */
export function consumerSourceRoots(): string[] {
  const appsDir = path.join(WORKSPACE_ROOT, 'apps');
  const apps = fs.existsSync(appsDir)
    ? fs.readdirSync(appsDir).map((app) => path.join(appsDir, app, 'frontend/src'))
    : [];
  return [...apps, path.join(WORKSPACE_ROOT, 'core/dashboard/frontend/src')].filter((p) => fs.existsSync(p));
}
