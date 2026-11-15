import { vi } from 'vitest'
import { setupAlfheimTests } from '@alfheim/shared/testing'

setupAlfheimTests({ sharedStorage: false })

// Real dictionaries and LanguageContext (German without a provider, as in the app); unresolved keys throw.
vi.mock('@alfheim/shared', async (importOriginal) =>
  (await import('@alfheim/shared/testing')).strictTranslationMock(await importOriginal<typeof import('@alfheim/shared')>()),
)
