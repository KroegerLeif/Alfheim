import { afterEach, vi } from 'vitest'
import { setupAlfheimTests } from '@alfheim/shared/testing'
import { server } from './mocks/server'
import { setTestLocale } from './locale'

setupAlfheimTests({ server })
afterEach(() => {
  setTestLocale('en')
})

vi.mock('next/navigation', async () => (await import('@alfheim/shared/testing')).nextNavigationMock())

// next-intl with the real shared dictionaries. The active locale is "en" unless a test calls
// setTestLocale(). A key that does not resolve in the active dictionary throws, so a missing or
// misspelled key fails the test instead of silently rendering the key path.
vi.mock('next-intl', async () => {
  const actual = await vi.importActual<typeof import('next-intl')>('next-intl')
  const { getSharedMessages } = await import('@alfheim/shared')
  const { getTestLocale } = await import('./locale')
  const keyMock = (await import('@alfheim/shared/testing')).nextIntlKeyMock()

  const translators = new Map<string, ReturnType<typeof actual.createTranslator>>()
  const translatorFor = (namespace: string | undefined) => {
    const locale = getTestLocale()
    const cacheKey = `${locale}:${namespace ?? ''}`
    let translator = translators.get(cacheKey)
    if (!translator) {
      translator = actual.createTranslator({
        locale,
        messages: getSharedMessages(locale),
        namespace: namespace as never,
        onError: (error) => {
          throw error
        },
        getMessageFallback: ({ namespace: ns, key }) => {
          throw new Error(`Unresolved i18n key "${ns ? `${ns}.` : ''}${key}" (locale: ${locale})`)
        },
      })
      translators.set(cacheKey, translator)
    }
    return translator
  }

  return {
    ...actual,
    useTranslations: (namespace?: string) => translatorFor(namespace),
    useLocale: () => getTestLocale(),
    Link: keyMock.Link,
    useRouter: keyMock.useRouter,
    usePathname: keyMock.usePathname,
  }
})
