import type { Language } from '@alfheim/shared'

let locale: Language = 'en'

/** Locale the mocked shared `useTranslation` resolves keys in; reset to "en" after every test. */
export function getTestLocale(): Language {
  return locale
}

export function setTestLocale(next: Language): void {
  locale = next
}
