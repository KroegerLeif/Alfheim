import '@testing-library/jest-dom'
import { vi, expect, beforeAll, afterEach, afterAll } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import 'vitest-axe/extend-expect'
import { server } from './mocks/server'
import { setTestLocale } from './locale'

expect.extend(matchers)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  setTestLocale('en')
})
afterAll(() => server.close())

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

// next-intl with the real shared dictionaries. The active locale is "en" unless a test calls
// setTestLocale(). A key that does not resolve in the active dictionary throws, so a missing or
// misspelled key fails the test instead of silently rendering the key path.
vi.mock('next-intl', async () => {
  const actual = await vi.importActual<typeof import('next-intl')>('next-intl')
  const { getSharedMessages } = await import('@alfheim/shared')
  const { getTestLocale } = await import('./locale')

  const translators = new Map<string, ReturnType<typeof actual.createTranslator>>()
  const translatorFor = (namespace: string | undefined) => {
    const locale = getTestLocale()
    const cacheKey = `${locale}:${namespace ?? ''}`
    let translator = translators.get(cacheKey)
    if (!translator) {
      translator = actual.createTranslator({
        locale,
        messages: getSharedMessages(locale),
        namespace: namespace as never,
        onError: (error) => {
          throw error
        },
        getMessageFallback: ({ namespace: ns, key }) => {
          throw new Error(`Unresolved i18n key "${ns ? `${ns}.` : ''}${key}" (locale: ${locale})`)
        },
      })
      translators.set(cacheKey, translator)
    }
    return translator
  }

  return {
    ...actual,
    useTranslations: (namespace?: string) => translatorFor(namespace),
    useLocale: () => getTestLocale(),
    Link: ({ children, ...props }: any) => {
      const React = require('react')
      return React.createElement('a', props, children)
    },
    useRouter() {
      return {
        push: () => null,
        replace: () => null,
      }
    },
    usePathname() {
      return ''
    },
  }
})
