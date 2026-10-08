import '@testing-library/jest-dom'
import { vi } from 'vitest'

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

// Wrap the shared library's real useTranslation hook for tests.
//
// Translations come from the real dictionaries and the real LanguageContext, so components rendered
// under <LanguageProvider defaultLanguage="de"> show German text exactly as in production (and German
// is also what a component rendered without any provider gets, as in the app). Any key that does not
// resolve in the active dictionary throws, so a missing or unprefixed key fails the test instead of
// silently rendering a raw key or the last key segment.
vi.mock('@alfheim/shared', async () => {
  const actual = await vi.importActual<typeof import('@alfheim/shared')>('@alfheim/shared')
  return {
    ...actual,
    useTranslation: () => {
      const result = actual.useTranslation()
      return {
        ...result,
        t: (key: string, params?: Record<string, string | number>) => {
          const value = result.t(key, params)
          if (value === key) {
            throw new Error(`Unresolved i18n key "${key}" (language: ${result.language})`)
          }
          return value
        },
      }
    },
  }
})
