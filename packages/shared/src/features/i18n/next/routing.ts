/**
 * Locale routing shared by every next-intl frontend. Kept free of next-intl imports so the
 * proxy, request config and navigation factories can all build on it.
 */

/** Locales every Alfheim frontend serves, in URL order. */
export const ALFHEIM_LOCALES = ['en', 'de', 'pl'] as const;

/** One of {@link ALFHEIM_LOCALES}. */
export type AlfheimLocale = (typeof ALFHEIM_LOCALES)[number];

/** Every route carries its locale prefix (`/pantry/en/...`), so deep links are unambiguous. */
export const ALFHEIM_LOCALE_PREFIX = 'always' as const;

/** Narrows an untrusted locale string, e.g. a URL segment, to a supported locale. */
export function isAlfheimLocale(locale: string | undefined | null): locale is AlfheimLocale {
  return typeof locale === 'string' && (ALFHEIM_LOCALES as readonly string[]).includes(locale);
}
