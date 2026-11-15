import { vi } from 'vitest'
import { setupAlfheimTests } from '@alfheim/shared/testing'
import { server } from './mocks/server'

setupAlfheimTests({ server })

vi.mock('next/navigation', async () => (await import('@alfheim/shared/testing')).nextNavigationMock())
vi.mock('@/navigation', async () => (await import('@alfheim/shared/testing')).appNavigationMock())
vi.mock('next-intl', async () => (await import('@alfheim/shared/testing')).nextIntlKeyMock())
// Real dictionaries and LanguageContext (German without a provider, as in the app); unresolved keys throw.
vi.mock('@alfheim/shared', async (importOriginal) =>
  (await import('@alfheim/shared/testing')).strictTranslationMock(await importOriginal<typeof import('@alfheim/shared')>()),
)
