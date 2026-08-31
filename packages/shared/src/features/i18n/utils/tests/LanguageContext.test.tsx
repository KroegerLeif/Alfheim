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
})
