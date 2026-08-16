import '@testing-library/jest-dom'
import { vi, expect, beforeAll, afterEach, afterAll } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import { server } from './mocks/server'

import 'vitest-axe/extend-expect'

expect.extend(matchers)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
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

// Mock next-intl translations and localized routing
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
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
}))

// Mock @alfheim/shared translation hook
vi.mock('@alfheim/shared', async () => {
  const actual = await vi.importActual<any>('@alfheim/shared')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const parts = key.split('.')
        return parts[parts.length - 1]
      },
      language: 'en',
      setLanguage: () => {},
    }),
  }
})
