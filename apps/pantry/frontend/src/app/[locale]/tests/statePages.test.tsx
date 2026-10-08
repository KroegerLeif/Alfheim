import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@alfheim/shared'
import ErrorPage from '../error'
import Loading from '../loading'

describe('locale state pages', () => {
  it('renders the error boundary in the active language and offers a retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reset = vi.fn()
    render(
      <LanguageProvider defaultLanguage="de">
        <ErrorPage error={new Error('boom')} reset={reset} />
      </LanguageProvider>
    )

    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(reset).toHaveBeenCalled()
  })

  it('renders the loading page in the active language', () => {
    render(
      <LanguageProvider defaultLanguage="pl">
        <Loading />
      </LanguageProvider>
    )
    expect(screen.getByText('Ładowanie...')).toBeInTheDocument()
  })
})
