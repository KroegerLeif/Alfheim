import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { getSharedMessages } from '../utils/locales';
import { isAlfheimLocale, type AlfheimLocale } from './routing';

/** Loads the message catalogue for a supported locale. */
export type AppMessagesLoader = (locale: AlfheimLocale) => ReturnType<typeof getSharedMessages>;

/** Options for {@link createRequestConfig}. */
export interface AppRequestConfigOptions {
  /** Message source. Defaults to the shared catalogue (`getSharedMessages`). */
  loadMessages?: AppMessagesLoader;
}

/**
 * The next-intl request config for an app's `src/i18n.ts`: validates the locale segment
 * (unsupported locales render the 404 page) and returns the shared messages.
 *
 * @example
 * export default createRequestConfig();
 */
export function createRequestConfig({ loadMessages = getSharedMessages }: AppRequestConfigOptions = {}) {
  return getRequestConfig(async ({ requestLocale }) => {
    const locale = await requestLocale;
    if (!isAlfheimLocale(locale)) notFound();
    return { locale, messages: loadMessages(locale) };
  });
}
