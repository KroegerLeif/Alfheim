import '@testing-library/jest-dom'
import { vi, expect, beforeAll, afterEach, afterAll } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import { server } from './mocks/server'
import { resetNavigationMock } from './mocks/navigation'

expect.extend(matchers)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  resetNavigationMock()
  localStorage.clear()
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

// Mock next/navigation router hooks; tests assert on the shared mockRouter.
vi.mock('next/navigation', async () => {
  const nav = await import('./mocks/navigation')
  return {
    useRouter: () => nav.mockRouter,
    usePathname: () => nav.mockNavigation.pathname,
    useSearchParams: () => new URLSearchParams(nav.mockNavigation.search),
    useParams: () => ({}),
  }
})

// Mock @alfheim/shared translation hook: shared keys render as their last
// segment. App-local `household_app.*` keys resolve from src/i18n (EN).
vi.mock('@alfheim/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@alfheim/shared')
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
