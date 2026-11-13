import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  appNavigationMock,
  createStorageMock,
  nextIntlKeyMock,
  nextNavigationMock,
  strictTranslationMock,
} from '..'

describe('shared test doubles', () => {
  it('stores, lists and clears values in memory', () => {
    const storage = createStorageMock()
    storage.setItem('a', '1')
    expect(storage.getItem('a')).toBe('1')
    expect(storage.key(0)).toBe('a')
    expect(storage.length).toBe(1)
    storage.removeItem('a')
    expect(storage.getItem('a')).toBeNull()
    storage.setItem('b', '2')
    storage.clear()
    expect(storage.length).toBe(0)
    expect(storage.key(0)).toBeNull()
  })

  it('provides inert navigation and next-intl modules', () => {
    const next = nextNavigationMock()
    expect(next.usePathname()).toBe('')
    expect(next.useParams()).toEqual({})
    expect(next.useSearchParams().toString()).toBe('')
    expect(typeof next.useRouter().push).toBe('function')

    const intl = nextIntlKeyMock()
    expect(intl.useTranslations()('a.b')).toBe('a.b')
    expect(intl.useLocale()).toBe('en')
    expect(intl.usePathname()).toBe('')
    expect(typeof intl.useRouter().replace).toBe('function')

    const app = appNavigationMock()
    expect(app.usePathname()).toBe('')
    expect(typeof app.useRouter().back).toBe('function')
    render(<app.Link href="/x">go</app.Link>)
    expect(screen.getByRole('link', { name: 'go' })).toHaveAttribute('href', '/x')
  })

  it('throws on keys that do not resolve and passes resolved ones through', () => {
    const actual = {
      useTranslation: () => ({ t: (key: string) => (key === 'ok' ? 'Fine' : key), language: 'en' }),
    }
    const { t } = strictTranslationMock(actual).useTranslation()
    expect(t('ok')).toBe('Fine')
    expect(() => t('missing')).toThrow('Unresolved i18n key "missing" (language: en)')
  })
})
