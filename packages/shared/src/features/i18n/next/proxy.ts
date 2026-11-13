import createMiddleware from 'next-intl/middleware';
import { ALFHEIM_LOCALES, ALFHEIM_LOCALE_PREFIX, type AlfheimLocale } from './routing';

/** Options for {@link createProxy}. */
export interface AppProxyOptions {
  /** Locale used when the request names none. Defaults to `en`. */
  defaultLocale?: AlfheimLocale;
}

/**
 * The next-intl locale proxy for an app's `src/proxy.ts`. Next.js reads `config.matcher`
 * statically, so the app file keeps its own literal `config` export next to this call.
 *
 * @example
 * export default createProxy({ defaultLocale: 'de' });
 */
export function createProxy({ defaultLocale = 'en' }: AppProxyOptions = {}) {
  return createMiddleware({
    defaultLocale,
    locales: ALFHEIM_LOCALES,
    localePrefix: ALFHEIM_LOCALE_PREFIX,
  });
}
