/**
 * Static helpers for the household i18n tests: flatten dictionaries and find
 * the literal translation keys used in the app's source files.
 */
import fs from 'node:fs';
import path from 'node:path';

export const LANGUAGES = ['en', 'de', 'pl'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const SRC_DIR = path.resolve(__dirname, '../..');

type Json = { [key: string]: Json | string };

export function flatten(obj: Json, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else flatten(value, full, out);
  }
  return out;
}

const SKIP_DIRS = new Set(['node_modules', '.next', 'tests', '__tests__']);

export function listSourceFiles(dir: string = SRC_DIR, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) && !entry.name.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

export interface KeyUsage {
  file: string;
  line: number;
  key: string;
}

/** Namespaces the household app translates (local `household_app`, shared `household`, …). */
const KEY_LITERAL = /(['"`])((?:household_app|household|profile|common|dashboard)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\1/g;

/**
 * Every string literal that looks like a translation key. Scanning all literals
 * (not only `t('…')` calls) also covers keys passed through helpers such as
 * role-label maps or success-message callbacks.
 */
export function extractKeys(source: string, file: string): KeyUsage[] {
  return [...source.matchAll(KEY_LITERAL)].map((match) => ({
    file,
    line: source.slice(0, match.index).split('\n').length,
    key: match[2],
  }));
}

/** `t(` calls whose key is built at runtime and therefore cannot be checked statically. */
export function findDynamicKeys(source: string, file: string): KeyUsage[] {
  return [...source.matchAll(/(?<![\w.])t\(\s*`[^`]*\$\{/g)].map((match) => ({
    file,
    line: source.slice(0, match.index).split('\n').length,
    key: match[0],
  }));
}

/** Placeholder names used by a message, e.g. `{name}`. */
export function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}
