import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ThemeProvider } from '../hooks/ThemeContext'
import { useTheme } from '../hooks/useTheme'
import type { CustomColorsConfig } from '../types'

const DEFAULT_COLORS: CustomColorsConfig = {
  dark: { primary: '#10b981', canvas: '#0f172a', accent: '#10b981', mint: '#10b981', cyan: '#06b6d4', gold: '#f59e0b' },
  light: { primary: '#059669', canvas: '#f8fafc', accent: '#059669', mint: '#059669', cyan: '#0891b2', gold: '#d97706' },
}
const FULL_COLORS: CustomColorsConfig = {
  dark: { primary: '#111111', canvas: '#222222', accent: '#333333', mint: '#444444', cyan: '#555555', gold: '#666666' },
  light: { primary: '#aaaaaa', canvas: '#bbbbbb', accent: '#cccccc', mint: '#dddddd', cyan: '#eeeeee', gold: '#ffffff' },
}

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>

function dispatchStorage(key: string | null, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
  })
}

describe('ThemeProvider stored preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('ignores unknown stored modes and variants and falls back to the defaults', () => {
    localStorage.setItem('alfheim_theme_override', JSON.stringify({ mode: 'neon', variant: 'pink' }))
    localStorage.setItem('stitch-theme', 'pink')
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultMode="light" defaultVariant="slate">
          {children}
        </ThemeProvider>
      ),
    })
    expect(result.current.mode).toBe('light')
    expect(result.current.variant).toBe('slate')
    expect(result.current.isDark).toBe(false)
  })

  it('loads fully stored custom colors as they are', () => {
    localStorage.setItem('alfheim_custom_theme', JSON.stringify(FULL_COLORS))
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.customColors).toEqual(FULL_COLORS)
  })

  it('fills missing custom colors with the defaults', () => {
    localStorage.setItem('alfheim_custom_theme', JSON.stringify({ dark: { primary: '#123456' } }))
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.customColors).toEqual({
      dark: { ...DEFAULT_COLORS.dark, primary: '#123456' },
      light: DEFAULT_COLORS.light,
    })
  })

  it('falls back to default custom colors when the stored value is not JSON', () => {
    localStorage.setItem('alfheim_custom_theme', '{broken')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.customColors).toEqual(DEFAULT_COLORS)
  })

  it('persists custom colors', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setCustomColors(FULL_COLORS))
    expect(result.current.customColors).toEqual(FULL_COLORS)
    expect(JSON.parse(localStorage.getItem('alfheim_custom_theme')!)).toEqual(FULL_COLORS)
  })
})

describe('ThemeProvider storage events', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('applies custom colors from another tab, filling missing values', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    dispatchStorage('alfheim_custom_theme', JSON.stringify({ light: { canvas: '#fefefe' } }))
    expect(result.current.customColors).toEqual({
      dark: DEFAULT_COLORS.dark,
      light: { ...DEFAULT_COLORS.light, canvas: '#fefefe' },
    })
    dispatchStorage('alfheim_custom_theme', JSON.stringify(FULL_COLORS))
    expect(result.current.customColors).toEqual(FULL_COLORS)
  })

  it('ignores custom color events without colors, invalid JSON and unrelated keys', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    dispatchStorage('alfheim_custom_theme', JSON.stringify({ other: true }))
    dispatchStorage('alfheim_custom_theme', null)
    dispatchStorage('alfheim_custom_theme', '{broken')
    dispatchStorage('unrelated', 'x')
    expect(result.current.customColors).toEqual(DEFAULT_COLORS)
  })

  it('ignores override events with unknown values, missing values and invalid JSON', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    const before = { mode: result.current.mode, variant: result.current.variant }
    dispatchStorage('alfheim_theme_override', JSON.stringify({ mode: 'neon', variant: 'pink' }))
    dispatchStorage('alfheim_theme_override', null)
    dispatchStorage('alfheim_theme_override', '{broken')
    expect({ mode: result.current.mode, variant: result.current.variant }).toEqual(before)
  })
})

describe('ThemeProvider system mode and toggle', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('follows the system color scheme in system mode', () => {
    let listener: ((e: MediaQueryListEvent) => void) | undefined
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
        listener = cb
      },
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider defaultMode="system">{children}</ThemeProvider>,
    })
    expect(result.current.resolvedMode).toBe('dark')
    act(() => listener?.({ matches: false } as MediaQueryListEvent))
    expect(result.current.resolvedMode).toBe('light')
    expect(result.current.isDark).toBe(false)
    act(() => listener?.({ matches: true } as MediaQueryListEvent))
    expect(result.current.isDark).toBe(true)
  })

  it('skips the system listener when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider defaultMode="system">{children}</ThemeProvider>,
    })
    expect(['dark', 'light']).toContain(result.current.resolvedMode)
  })

  it('toggles between nordic and obsidian and persists the choice', () => {
    localStorage.setItem('alfheim_theme_override', JSON.stringify({ mode: 'light', variant: 'nordic' }))
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.toggleTheme())
    expect(result.current.variant).toBe('obsidian')
    expect(JSON.parse(localStorage.getItem('alfheim_theme_override')!)).toEqual({ mode: 'light', variant: 'obsidian' })
    act(() => result.current.toggleTheme())
    expect(result.current.variant).toBe('nordic')
    expect(localStorage.getItem('stitch-theme')).toBe('nordic')
  })
})
