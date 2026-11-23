import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { LanguageProvider, useLanguage } from '../LanguageContext'

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes and allows updating language', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider defaultLanguage="de">{children}</LanguageProvider>
    )

    const { result } = renderHook(() => useLanguage(), { wrapper })
    expect(result.current.language).toBe('de')

    act(() => {
      result.current.setLanguage('en')
    })

    expect(result.current.language).toBe('en')
    expect(localStorage.getItem('alfheim_language')).toBe('en')
  })

  it('follows the route locale on mount and copies a stored choice into the locale cookie', () => {
    localStorage.setItem('alfheim_language', 'pl')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider defaultLanguage="en">{children}</LanguageProvider>
    )

    const { result } = renderHook(() => useLanguage(), { wrapper })

    expect(result.current.language).toBe('en')
    expect(document.cookie).toContain('NEXT_LOCALE=pl')
  })

  it('switches to a new route locale', () => {
    let routeLanguage: 'de' | 'en' | 'pl' = 'de'
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider defaultLanguage={routeLanguage}>{children}</LanguageProvider>
    )
    const { result, rerender } = renderHook(() => useLanguage(), { wrapper })
    expect(result.current.language).toBe('de')

    routeLanguage = 'pl'
    rerender()
    expect(result.current.language).toBe('pl')
  })
})
