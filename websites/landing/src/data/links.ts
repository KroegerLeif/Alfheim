import type { Language } from '@alfheim/shared';

/** Source repository of Alfheim. */
export const GITHUB_URL = 'https://github.com/KroegerLeif/Alfheim';

/**
 * URL of a page in the documentation portal, served under /docs next to this page.
 * The portal ships English and German; Polish readers get the English pages.
 *
 * @param locale - Current landing page language.
 * @param page - Path below the language root without leading slash, for example
 *   `how-to/homelab-deployment/`; empty for the portal start page.
 */
export function docsHref(locale: Language, page = ''): string {
  const lang = locale === 'de' ? 'de' : 'en';
  return `/docs/${lang}/${page}`;
}
