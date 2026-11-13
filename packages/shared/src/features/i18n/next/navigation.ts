import { createNavigation as createNextIntlNavigation } from 'next-intl/navigation';
import { ALFHEIM_LOCALES, ALFHEIM_LOCALE_PREFIX } from './routing';

export { ALFHEIM_LOCALES, ALFHEIM_LOCALE_PREFIX, isAlfheimLocale, type AlfheimLocale } from './routing';

/**
 * Locale-aware `Link`, `redirect`, `usePathname` and `useRouter` for an app's `src/navigation.ts`.
 * Imported from `@alfheim/shared/i18n/navigation`, not the package root, so apps without
 * next-intl never load it.
 *
 * @example
 * export const { Link, redirect, usePathname, useRouter } = createNavigation();
 */
export function createNavigation() {
  return createNextIntlNavigation({ locales: ALFHEIM_LOCALES, localePrefix: ALFHEIM_LOCALE_PREFIX });
}
