import { createElement, type PropsWithChildren } from 'react';
import { vi } from 'vitest';

/** Renders next-intl's and the app's `Link` as a plain anchor. */
function AnchorLink({ children, ...props }: PropsWithChildren<Record<string, unknown>>) {
  return createElement('a', props, children);
}

/** Module double for `next/navigation`: inert router, empty path, params and search params. */
export function nextNavigationMock() {
  return {
    useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => '',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    notFound: vi.fn(),
    redirect: vi.fn(),
  };
}

/** Module double for an app's `@/navigation` (the next-intl navigation helpers). */
export function appNavigationMock() {
  return {
    Link: AnchorLink,
    useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => '',
    redirect: vi.fn(),
  };
}

/** Module double for `next-intl` that renders translation keys as they are and serves `en`. */
export function nextIntlKeyMock() {
  return {
    useTranslations: () => (key: string) => key,
    useLocale: () => 'en',
    Link: AnchorLink,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '',
  };
}

/** The slice of `@alfheim/shared` that {@link strictTranslationMock} wraps. */
export interface TranslationModule {
  useTranslation: () => {
    t: (key: string, params?: Record<string, string | number>) => string;
    language: string;
  };
}

/**
 * Module double for `@alfheim/shared` with the real dictionaries and `LanguageContext`, whose
 * `t` throws on a key that does not resolve in the active language. A missing or unprefixed key
 * then fails the test instead of rendering a raw key fragment.
 *
 * @example
 * vi.mock('@alfheim/shared', async (importOriginal) =>
 *   (await import('@alfheim/shared/testing')).strictTranslationMock(await importOriginal()));
 */
export function strictTranslationMock<M extends TranslationModule>(actual: M): M {
  return {
    ...actual,
    useTranslation: () => {
      const result = actual.useTranslation();
      return {
        ...result,
        t: (key: string, params?: Record<string, string | number>) => {
          const value = result.t(key, params);
          if (value === key) {
            throw new Error(`Unresolved i18n key "${key}" (language: ${result.language})`);
          }
          return value;
        },
      };
    },
  };
}
