import { vi } from 'vitest'
import { setupAlfheimTests } from '@alfheim/shared/testing'
import { server } from './mocks/server'
import { resetNavigationMock } from './mocks/navigation'

setupAlfheimTests({
  server,
  afterEach: () => {
    resetNavigationMock()
    localStorage.clear()
  },
})

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
