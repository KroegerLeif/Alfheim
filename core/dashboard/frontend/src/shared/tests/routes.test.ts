import { describe, it, expect } from 'vitest'
import { isDashboardRoute } from '../routes'

describe('isDashboardRoute', () => {
  it('treats the dashboard-owned routes as internal', () => {
    expect(isDashboardRoute('/')).toBe(true)
    expect(isDashboardRoute('/settings')).toBe(true)
    expect(isDashboardRoute('/under-construction')).toBe(true)
    expect(isDashboardRoute('/under-construction?app=TODO')).toBe(true)
  })

  it('treats every other absolute path as owned by another microfrontend', () => {
    expect(isDashboardRoute('/pantry')).toBe(false)
    expect(isDashboardRoute('/shopping')).toBe(false)
    expect(isDashboardRoute('/household')).toBe(false)
    expect(isDashboardRoute('/household/profile')).toBe(false)
    expect(isDashboardRoute('/chores/de')).toBe(false)
  })

  it('treats external URLs and empty values as not internal', () => {
    expect(isDashboardRoute('https://example.com')).toBe(false)
    expect(isDashboardRoute('http://homeassistant.local')).toBe(false)
    expect(isDashboardRoute('')).toBe(false)
    expect(isDashboardRoute(undefined)).toBe(false)
    expect(isDashboardRoute(null)).toBe(false)
    expect(isDashboardRoute('#')).toBe(false)
  })
})
