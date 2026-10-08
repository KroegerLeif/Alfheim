import '@testing-library/jest-dom'
import { createElement, type PropsWithChildren } from 'react'
import { afterEach, vi } from 'vitest'
import { setTestLocale } from './locale'

afterEach(() => {
  setTestLocale('en')
})

// Mock localStorage and sessionStorage globally for tests
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(global, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock next/navigation router hooks
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: () => null,
      replace: () => null,
      back: () => null,
    }
  },
  usePathname() {
    return ''
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  useParams() {
    return {}
  },
}))

// Mock next-intl translations and localized routing
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  Link: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) =>
    createElement('a', props, children),
  useRouter() {
    return {
      push: () => null,
      replace: () => null,
    }
  },
  usePathname() {
    return ''
  },
}))

// The shared translation hook backed by the real dictionaries. Keys resolve in the test
// locale ("en" unless a test calls setTestLocale) without the hook's German fallback, and
// a key that does not resolve throws, so a missing or misspelled key fails the test instead
// of rendering a key fragment.
vi.mock('@alfheim/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alfheim/shared')>()
  const { getTestLocale } = await import('./locale')

  const lookup = (key: string): string => {
    const language = getTestLocale()
    let current: unknown = actual.getSharedMessages(language)
    for (const part of key.split('.')) {
      current = (current as Record<string, unknown> | undefined)?.[part]
    }
    if (typeof current !== 'string') {
      throw new Error(`Unresolved i18n key "${key}" (language: ${language})`)
    }
    return current
  }

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        Object.entries(params ?? {}).reduce(
          (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
          lookup(key)
        ),
      language: getTestLocale(),
      setLanguage: () => {},
    }),
  }
})
