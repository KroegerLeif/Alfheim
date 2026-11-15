import { vi } from 'vitest'
// jsdom ships no IndexedDB, which the offline sync queue depends on.
import 'fake-indexeddb/auto'
import { setupAlfheimTests } from '@alfheim/shared/testing'
import { server } from './mocks/server'
import { routerMock } from './mocks/router'

setupAlfheimTests({ server, afterEach: () => Object.values(routerMock).forEach((spy) => spy.mockClear()) })

vi.mock('next/navigation', async () => (await import('@alfheim/shared/testing')).nextNavigationMock())
// useRouter returns one shared double (see ./mocks/router) so tests can assert navigation.
vi.mock('@/navigation', async () => {
  const { routerMock: router } = await import('./mocks/router')
  return { ...(await import('@alfheim/shared/testing')).appNavigationMock(), useRouter: () => router }
})
vi.mock('next-intl', async () => (await import('@alfheim/shared/testing')).nextIntlKeyMock())
// Real dictionaries and LanguageContext (German without a provider, as in the app); unresolved keys throw.
vi.mock('@alfheim/shared', async (importOriginal) =>
  (await import('@alfheim/shared/testing')).strictTranslationMock(await importOriginal<typeof import('@alfheim/shared')>()),
)
