import { afterEach, vi } from 'vitest'
import { setupAlfheimTests } from '@alfheim/shared/testing'
import { setTestLocale } from './locale'

setupAlfheimTests()
afterEach(() => {
  setTestLocale('en')
})

vi.mock('next/navigation', async () => (await import('@alfheim/shared/testing')).nextNavigationMock())
vi.mock('next-intl', async () => (await import('@alfheim/shared/testing')).nextIntlKeyMock())

// The shared translation hook backed by the real dictionaries. Keys resolve in the test
// locale ("en" unless a test calls setTestLocale) without the hook's German fallback, and
// a key that does not resolve throws, so a missing or misspelled key fails the test instead
// of rendering a key fragment.
vi.mock('@alfheim/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alfheim/shared')>()
  const { getTestLocale } = await import('./locale')

  const lookup = (key: string): string => {
    const language = getTestLocale()
    let current: unknown = actual.getSharedMessages(language)
    for (const part of key.split('.')) {
      current = (current as Record<string, unknown> | undefined)?.[part]
    }
    if (typeof current !== 'string') {
      throw new Error(`Unresolved i18n key "${key}" (language: ${language})`)
    }
    return current
  }

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        Object.entries(params ?? {}).reduce(
          (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
          lookup(key)
        ),
      language: getTestLocale(),
      setLanguage: () => {},
    }),
  }
})
