import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  LANGUAGES,
  SHARED_SRC,
  WORKSPACE_ROOT,
  consumerSourceRoots,
  extractSharedKeys,
  listSourceFiles,
  loadLanguage,
  type KeyUsage,
} from '../../../tests/i18nScan';

/**
 * Guards against issue #579: `t()` calls with keys that never resolve (for example an
 * unprefixed `t('save')` instead of `t('common.save')`) render the raw key in production.
 * Component tests cannot catch this when they mock `t()`, so these checks read the source.
 */
const dictionaries = Object.fromEntries(LANGUAGES.map((lang) => [lang, loadLanguage(lang)])) as Record<
  (typeof LANGUAGES)[number],
  Record<string, string>
>;

function usagesIn(roots: string[]): KeyUsage[] {
  return roots.flatMap((root) =>
    listSourceFiles(root).flatMap((file) => extractSharedKeys(fs.readFileSync(file, 'utf8'), file)),
  );
}

const describeUsage = (u: KeyUsage) => `${path.relative(WORKSPACE_ROOT, u.file)}:${u.line} ${u.key}`;

describe('shared t() keys', () => {
  const sharedUsages = usagesIn([path.join(SHARED_SRC, 'features')]);

  it('finds the literal keys used by shared components', () => {
    expect(sharedUsages.length).toBeGreaterThan(50);
    expect(sharedUsages.map((u) => u.key)).toContain('common.close');
  });

  it('resolves every key used in packages/shared in en, de and pl without fallback', () => {
    const unresolved = LANGUAGES.flatMap((lang) =>
      sharedUsages.filter((u) => !(u.key in dictionaries[lang])).map((u) => `${lang}: ${describeUsage(u)}`),
    );
    expect(unresolved).toEqual([]);
  });

  it('resolves every key that consumer frontends pass to the shared t()', () => {
    const consumerUsages = usagesIn(consumerSourceRoots());
    expect(consumerUsages.length).toBeGreaterThan(100);
    // The hook falls back to German, so a key must exist in de and in en; pl gaps are
    // tracked by the locale parity test instead.
    const unresolved = (['de', 'en'] as const).flatMap((lang) =>
      consumerUsages.filter((u) => !(u.key in dictionaries[lang])).map((u) => `${lang}: ${describeUsage(u)}`),
    );
    expect(unresolved).toEqual([]);
  });
});

describe('extractSharedKeys', () => {
  it('only reads the function destructured from the shared hook', () => {
    const source = [
      "import { useTranslations } from 'next-intl';",
      "import { Button, useTranslation as useSharedTranslation } from '@alfheim/shared';",
      "const t = useTranslations('maintenance');",
      'const { t: tShared, language } = useSharedTranslation();',
      "t('header.title'); tShared('common.save'); tShared(`budget.${dynamic}`); obj.tShared('x.y');",
    ].join('\n');
    expect(extractSharedKeys(source, 'x.tsx').map((u) => u.key)).toEqual(['common.save']);
  });

  it('ignores files that do not import the shared hook', () => {
    expect(extractSharedKeys("const { t } = useTranslation(); t('save');", 'x.tsx')).toEqual([]);
  });

  it('recognises relative imports inside the shared package', () => {
    const source = "import { useTranslation } from '../../i18n/utils/useTranslation';\nconst { t } = useTranslation();\nt(\"save\");";
    expect(extractSharedKeys(source, 'x.tsx')).toEqual([{ file: 'x.tsx', line: 3, key: 'save' }]);
  });
});
