import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSystemMode,
  parseHex,
  hexToRgba,
  adjustBrightness,
  applyThemeToDOM,
} from '../utils/themeDomUtils'

describe('themeDomUtils', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-mode')
    document.documentElement.removeAttribute('data-theme-variant')
    document.documentElement.style.cssText = ''
  })

  it('getSystemMode returns dark when matchMedia matches dark preference', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList)

    expect(getSystemMode()).toBe('dark')
  })

  it('getSystemMode returns light when matchMedia matches light preference', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList)

    expect(getSystemMode()).toBe('light')
  })

  it('parseHex parses 3-digit and 6-digit hex strings correctly', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('00ff00')).toEqual({ r: 0, g: 255, b: 0 })
    expect(parseHex('invalid')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('hexToRgba formats color with alpha transparency', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('adjustBrightness clamps values between 0 and 255', () => {
    expect(adjustBrightness('#000000', 50)).toBe('#323232')
    expect(adjustBrightness('#ffffff', 50)).toBe('#ffffff')
    expect(adjustBrightness('#000000', -50)).toBe('#000000')
  })

  it('applyThemeToDOM applies predefined theme tokens to HTML document root', () => {
    applyThemeToDOM('nordic', 'dark')

    expect(document.documentElement.getAttribute('data-theme')).toBe('nordic')
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--surface-canvas')).not.toBe('')
  })

  it('applyThemeToDOM applies light theme mode attributes correctly', () => {
    applyThemeToDOM('kinetic', 'light')

    expect(document.documentElement.getAttribute('data-mode')).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applyThemeToDOM calculates custom colors in dark and light modes with fallbacks', () => {
    applyThemeToDOM('custom', 'dark', { dark: {} } as any)
    expect(document.documentElement.getAttribute('data-theme')).toBe('custom')

    applyThemeToDOM('custom', 'light', { light: {} } as any)
    expect(document.documentElement.getAttribute('data-mode')).toBe('light')

    applyThemeToDOM('unknown' as any, 'dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('unknown')
  })
})
