import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { LANGUAGES, LOCALES_DIR, loadNamespace, namespaceFiles, type Lang } from '../../../tests/i18nScan';

/**
 * Known pre-existing gaps in app namespaces, owned by the per-app sweeps. Missing keys fall back
 * to German at runtime. Do not add entries here: a new key must land in en, de and pl together.
 * Remove entries as the owning app translates them.
 */
const KNOWN_GAPS: Partial<Record<Lang, Record<string, string[]>>> = {};

/** Namespaces owned by the shared package itself: these must always be in full parity. */
const SHARED_NAMESPACES = ['common.json'];

/**
 * Placeholder names used by a message. For ICU plural/select messages (consumed through next-intl)
 * only the argument names are compared, since the branch bodies are translated text.
 */
function placeholders(value: string): string[] {
  const icuArgs = [...value.matchAll(/\{(\w+),\s*(?:plural|select|selectordinal)\s*,/g)].map((m) => m[1]);
  const names = icuArgs.length > 0 ? icuArgs : [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

describe('locale parity', () => {
  it('has the same namespace files for every language', () => {
    const expected = namespaceFiles();
    for (const lang of LANGUAGES) {
      const files = fs.readdirSync(path.join(LOCALES_DIR, lang)).filter((f) => f.endsWith('.json')).sort();
      expect(files, `namespace files for ${lang}`).toEqual(expected);
    }
  });

  for (const file of namespaceFiles()) {
    it(`${file}: every key exists in en, de and pl`, () => {
      const dicts = Object.fromEntries(LANGUAGES.map((lang) => [lang, loadNamespace(lang, file)])) as Record<
        Lang,
        Record<string, string>
      >;
      const allKeys = new Set(LANGUAGES.flatMap((lang) => Object.keys(dicts[lang])));
      const missing: string[] = [];
      for (const lang of LANGUAGES) {
        const allowed = SHARED_NAMESPACES.includes(file) ? [] : (KNOWN_GAPS[lang]?.[file] ?? []);
        for (const key of allKeys) {
          if (!(key in dicts[lang]) && !allowed.includes(key)) missing.push(`${lang}: ${key}`);
        }
      }
      expect(missing, `missing keys in ${file}`).toEqual([]);
    });

    it(`${file}: translations keep the same {placeholders} as English`, () => {
      const en = loadNamespace('en', file);
      const mismatches: string[] = [];
      for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
        const dict = loadNamespace(lang, file);
        for (const [key, value] of Object.entries(en)) {
          if (key in dict && placeholders(dict[key]).join() !== placeholders(value).join()) {
            mismatches.push(`${lang}: ${key}`);
          }
        }
      }
      expect(mismatches, `placeholder mismatches in ${file}`).toEqual([]);
    });
  }
});
