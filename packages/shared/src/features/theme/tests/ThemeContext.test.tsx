import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider } from '../hooks/ThemeContext'
import { useTheme } from '../hooks/useTheme'

describe('ThemeContext & ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides default theme state and allows toggling mode and variant', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultMode="dark" defaultVariant="nordic">
        {children}
      </ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.mode).toBe('dark')
    expect(result.current.variant).toBe('nordic')
    expect(result.current.isDark).toBe(true)

    act(() => {
      result.current.setMode('light')
    })
    expect(result.current.mode).toBe('light')

    act(() => {
      result.current.setVariant('kinetic')
    })
    expect(result.current.variant).toBe('kinetic')

    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.variant).toBe('nordic')
  })

  it('loads override config from localStorage and handles storage events', () => {
    localStorage.setItem(
      'alfheim_theme_override',
      JSON.stringify({ mode: 'light', variant: 'obsidian' })
    )

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
    expect(result.current.variant).toBe('obsidian')

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'alfheim_theme_override',
          newValue: JSON.stringify({ mode: 'system', variant: 'slate' }),
        })
      )
    })
    expect(result.current.mode).toBe('system')
    expect(result.current.variant).toBe('slate')

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'alfheim_custom_theme',
          newValue: JSON.stringify({
            dark: { primary: '#123456' },
            light: { primary: '#654321' },
          }),
        })
      )
    })
  })

  it('falls back to legacy storage key when no modern override exists', () => {
    localStorage.setItem('stitch-theme', 'slate')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.variant).toBe('slate')
  })

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('alfheim_theme_override', 'invalid-json{')
    localStorage.setItem('alfheim_custom_theme', 'invalid-json{')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('dark')
  })
})
