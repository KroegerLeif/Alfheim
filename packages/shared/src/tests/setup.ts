import '@testing-library/jest-dom'
import { vi, expect } from 'vitest'
import * as matchers from 'vitest-axe/matchers'

import 'vitest-axe/extend-expect'
import { configure } from '@testing-library/react'

// findBy*/waitFor poll for 5s instead of 1s. The default 1s is shorter than legitimate latency: a cold first
// render, or ky retrying a failed GET with backoff (~0.9s), so tests failed once the machine was busy
// (CI, parallel workspaces). The limit only bounds failures; passing tests are not slowed down.
configure({ asyncUtilTimeout: 5000 })

expect.extend(matchers)

// Mock matchMedia globally for JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage and sessionStorage globally for tests
function createStorageMock() {
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
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length
    },
  }
}

Object.defineProperty(global, 'localStorage', {
  value: createStorageMock(),
  writable: true,
})
Object.defineProperty(global, 'sessionStorage', {
  value: createStorageMock(),
  writable: true,
})

// Mock next/navigation router hooks if used
vi.mock('next/navigation', () => ({
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
  useSearchParams() {
    return new URLSearchParams()
  },
  useParams() {
    return {}
  },
}))
