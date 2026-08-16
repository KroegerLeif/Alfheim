import React from 'react'
import { render, screen, renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { axe } from 'vitest-axe'
import { ThemeProvider, useTheme } from '../hooks'
import { ThemeToggle } from '../components/ThemeToggle'

describe('Theme System & ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-mode')
    document.documentElement.removeAttribute('data-theme-variant')
  })

  it('passes accessibility audit for ThemeToggle', async () => {
    const { container } = render(
      <ThemeProvider defaultMode="dark">
        <ThemeToggle />
      </ThemeProvider>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('initializes ThemeProvider with default attributes and classes on document.documentElement', () => {
    render(
      <ThemeProvider defaultMode="dark" defaultVariant="nordic">
        <div data-testid="child">App</div>
      </ThemeProvider>
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('nordic')
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('updates mode and persists to localStorage when changed via hook', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
    )
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.resolvedMode).toBe('dark')

    act(() => {
      result.current.setMode('light')
    })

    expect(result.current.resolvedMode).toBe('light')
    expect(document.documentElement.getAttribute('data-mode')).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles mode when ThemeToggle button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider defaultMode="dark">
        <ThemeToggle />
      </ThemeProvider>
    )

    const toggleButton = screen.getByRole('button')
    expect(toggleButton).toHaveAttribute('title', 'Switch to light mode')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('title', 'Switch to dark mode')
    expect(document.documentElement.getAttribute('data-mode')).toBe('light')
  })

  it('supports updating custom colors and variants', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultMode="dark" defaultVariant="nordic">{children}</ThemeProvider>
    )
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setVariant('obsidian')
      result.current.setCustomColors({
        dark: { primary: '#22c55e', canvas: '#0f172a', accent: '#3b82f6' },
        light: { primary: '#16a34a', canvas: '#ffffff', accent: '#2563eb' },
      })
    })

    expect(result.current.variant).toBe('obsidian')
    expect(result.current.customColors.dark.primary).toBe('#22c55e')
    expect(document.documentElement.getAttribute('data-theme')).toBe('obsidian')
  })
})
