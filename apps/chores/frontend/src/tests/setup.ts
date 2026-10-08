import '@testing-library/jest-dom'
import React, { ComponentProps } from 'react'
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

// Mock @/navigation
vi.mock('@/navigation', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => {
    return React.createElement('a', props, children)
  },
  useRouter() {
    return {
      prefetch: () => null,
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
    }
  },
  usePathname() {
    return ''
  },
  redirect: vi.fn(),
}))

// Mock next-intl translations and localized routing
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  Link: ({ children, ...props }: ComponentProps<'a'>) => {
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
// Translations come from the real dictionaries and the real LanguageContext, so components
// rendered without a provider show the default (German) text and components rendered under
// <LanguageProvider defaultLanguage="en"> show English, exactly as in production. A key that does
// not resolve in the active dictionary throws, so a missing or unprefixed key fails the test
// instead of silently rendering a raw key fragment.
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
