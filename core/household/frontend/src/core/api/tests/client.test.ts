import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api } from '../client'
import {
  ACTIVE_HOUSEHOLD_STORAGE_KEY,
  HOUSEHOLD_CHANGED_EVENT,
  replaceActiveHousehold,
  setActiveHousehold,
} from '@/lib/activeHousehold'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('household app client and active household', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchSpy = vi.fn().mockImplementation(async () => jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends X-Household-ID via the shared helper and never X-Household-Role', async () => {
    localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-1')
    await api.get('api/v1/households/me').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-1')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('setActiveHousehold writes the id and dispatches the change event', () => {
    const changed = vi.fn()
    window.addEventListener(HOUSEHOLD_CHANGED_EVENT, changed)
    setActiveHousehold('hh-2')
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBe('hh-2')
    expect(changed).toHaveBeenCalledTimes(1)
    window.removeEventListener(HOUSEHOLD_CHANGED_EVENT, changed)
  })

  it('replaceActiveHousehold falls back or clears, and always announces the membership change', () => {
    const changed = vi.fn()
    window.addEventListener(HOUSEHOLD_CHANGED_EVENT, changed)
    localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-left')
    replaceActiveHousehold('hh-left', 'hh-other')
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBe('hh-other')

    replaceActiveHousehold('hh-other')
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBeNull()

    changed.mockClear()
    replaceActiveHousehold('not-active')
    expect(changed).toHaveBeenCalledTimes(1)
    window.removeEventListener(HOUSEHOLD_CHANGED_EVENT, changed)
  })
})
