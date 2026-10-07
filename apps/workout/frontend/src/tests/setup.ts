import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
// jsdom ships no IndexedDB, which the offline sync queue depends on.
import 'fake-indexeddb/auto'
import { vi, expect, beforeAll, afterEach, afterAll } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import { server } from './mocks/server'
import { routerMock } from './mocks/router'

import 'vitest-axe/extend-expect'

expect.extend(matchers)

// The monorepo gate runs every frontend's suite in parallel; give async queries headroom on a busy machine.
configure({ asyncUtilTimeout: 5000 })

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  Object.values(routerMock).forEach((spy) => spy.mockClear())
})
afterAll(() => server.close())

// Mock localStorage and sessionStorage globally for tests
const localStorageMock = (function () {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
Object.defineProperty(global, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
})

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

// Mock @/navigation. useRouter returns one shared double (see ./mocks/router) so tests can assert navigation.
vi.mock('@/navigation', async () => {
  const { routerMock } = await import('./mocks/router')
  return {
    Link: ({ children, ...props }: any) => {
      const React = require('react')
      return React.createElement('a', props, children)
    },
    useRouter() {
      return routerMock
    },
    usePathname() {
      return ''
    },
    redirect: vi.fn(),
  }
})

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
      push: vi.fn(),
      replace: vi.fn(),
    }
  },
  usePathname() {
    return ''
  },
}))

// Wrap the shared library's real useTranslation hook for tests.
//
// Translations come from the real dictionaries and the real LanguageContext, so a component rendered
// under <LanguageProvider defaultLanguage="de"> shows German text exactly as in production (and German
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
