import { describe, it, expect } from 'vitest';
import { localMessages } from '..';
import { LANGUAGES, flatten, placeholders } from './i18nScan';

const dicts = Object.fromEntries(LANGUAGES.map((l) => [l, flatten(localMessages[l] as never)])) as Record<
  string,
  Record<string, string>
>;

describe('household locale parity', () => {
  it('ships a dictionary for every language of the shared switcher', () => {
    expect(Object.keys(localMessages).sort()).toEqual([...LANGUAGES].sort());
  });

  it('has every key in en, de and pl', () => {
    const allKeys = new Set(LANGUAGES.flatMap((l) => Object.keys(dicts[l])));
    const missing = LANGUAGES.flatMap((lang) =>
      [...allKeys].filter((key) => !(key in dicts[lang])).map((key) => `${lang}: ${key}`),
    );
    expect(missing).toEqual([]);
  });

  it('keeps the same {placeholders} as English', () => {
    const mismatches = LANGUAGES.filter((l) => l !== 'en').flatMap((lang) =>
      Object.entries(dicts.en)
        .filter(([key, value]) => placeholders(dicts[lang][key] ?? '').join() !== placeholders(value).join())
        .map(([key]) => `${lang}: ${key}`),
    );
    expect(mismatches).toEqual([]);
  });

  it('has no empty or untranslated Polish household_app strings', () => {
    const copies = Object.entries(dicts.pl)
      .filter(([key, value]) => key.startsWith('household_app.') && (!value.trim() || (value === dicts.en[key] && /[a-z]{4,}/i.test(value))))
      .map(([key]) => key);
    expect(copies).toEqual([]);
  });
});
