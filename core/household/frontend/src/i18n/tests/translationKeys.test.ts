import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { messages as sharedMessages } from '@alfheim/shared';
import { localMessages } from '..';
import { LANGUAGES, SRC_DIR, extractKeys, findDynamicKeys, flatten, listSourceFiles } from './i18nScan';

/**
 * Component tests mock `t()`, so an unresolved key would only show up as a raw
 * key in production. These checks read the source instead (mirrors
 * packages/shared/src/features/i18n/tests/translationKeys.test.ts).
 */
type Dict = Record<string, string>;
const local = Object.fromEntries(LANGUAGES.map((l) => [l, flatten(localMessages[l] as never)])) as Record<string, Dict>;
const shared = Object.fromEntries(LANGUAGES.map((l) => [l, flatten(sharedMessages[l])])) as Record<string, Dict>;

const sources = listSourceFiles().map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }));
const usages = sources.flatMap(({ file, source }) => extractKeys(source, file));
const where = (u: { file: string; line: number }) => `${path.relative(SRC_DIR, u.file)}:${u.line}`;

describe('household translation keys', () => {
  it('finds the keys used across the app', () => {
    expect(usages.length).toBeGreaterThan(150);
    expect(usages.map((u) => u.key)).toContain('household_app.settings.title');
    expect(usages.map((u) => u.key)).toContain('dashboard.household.roles.owner');
  });

  it('resolves every key in en, de and pl without falling back', () => {
    const unresolved = LANGUAGES.flatMap((lang) =>
      usages
        .filter((u) => !(u.key in local[lang]) && !(u.key in shared[lang]))
        .map((u) => `${lang}: ${where(u)} ${u.key}`),
    );
    expect(unresolved).toEqual([]);
  });

  it('never builds keys at runtime', () => {
    const dynamic = sources.flatMap(({ file, source }) => findDynamicKeys(source, file)).map(where);
    expect(dynamic).toEqual([]);
  });
});
