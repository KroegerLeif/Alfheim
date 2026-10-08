import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ErrorPage from '../error'
import { getLocalizedMetadata } from '@/lib/metadata'
import { setTestLocale } from '@/tests/locale'

describe('route error page', () => {
  it('renders localized text and lets the user retry', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reset = vi.fn()
    render(<ErrorPage error={Object.assign(new Error(''), { digest: 'd' })} reset={reset} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred while loading this page.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(reset).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('shows the error message in German and wraps long text', () => {
    setTestLocale('de')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const long = 'Fehler '.repeat(100)
    render(<ErrorPage error={new Error(long.trim())} reset={vi.fn()} />)

    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
    expect(screen.getByText(long.trim())).toHaveClass('break-words')
    spy.mockRestore()
  })
})

describe('getLocalizedMetadata', () => {
  it('returns the page title and description in each locale', () => {
    expect(getLocalizedMetadata('en')).toEqual({ title: 'Shopping Checklist', description: 'Checklist & Stock' })
    expect(getLocalizedMetadata('de')).toEqual({ title: 'Einkaufszettel', description: 'Checkliste & Vorrat' })
    expect(getLocalizedMetadata('pl')).toEqual({ title: 'Lista zakupów', description: 'Lista & Zapasy' })
  })

  it('falls back to German for an unknown locale', () => {
    expect(getLocalizedMetadata('fr').title).toBe('Einkaufszettel')
  })
})
