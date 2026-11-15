import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getRequestErrorMessage, subscribeHouseholdErrors } from '@alfheim/shared'
import { libraryClient } from '../api'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('libraryClient household context', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    })
    fetchSpy = vi.fn().mockImplementation(async () => jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends X-Household-ID for the active household and never X-Household-Role', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-3')
    await libraryClient.get('items').json()
    const headers = new Headers((fetchSpy.mock.calls[0][1] as RequestInit).headers)
    expect(headers.get('X-Household-ID')).toBe('hh-3')
    expect(headers.get('X-Household-Role')).toBeNull()
  })

  it('reports household_required to the household provider', async () => {
    fetchSpy.mockImplementation(async () =>
      jsonResponse(400, { detail: { code: 'household_required', message: 'X-Household-ID missing' } }),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await expect(libraryClient.get('items').json()).rejects.toBeTruthy()
    expect(listener).toHaveBeenCalledWith({ code: 'household_required', householdId: null })
    unsubscribe()
  })
})

describe('libraryClient network failures', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects with the browser error instead of a normalized API error', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    const error = await libraryClient.get('items').json().catch((err: unknown) => err)
    expect(error).toBeInstanceOf(TypeError)
    expect(error).not.toHaveProperty('status')
    expect(error).not.toHaveProperty('code')
  })

  it('keeps the browser message for text shown to the user', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    const error = await libraryClient.get('items').json().catch((err: unknown) => err)
    expect(getRequestErrorMessage(error)).toBe('Failed to fetch')
  })
})
