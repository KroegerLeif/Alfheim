import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { subscribeHouseholdErrors } from '@alfheim/shared'
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
    await libraryClient.get('api/v1/library/items').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-3')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('reports household_required to the household provider', async () => {
    fetchSpy.mockImplementation(async () =>
      jsonResponse(400, { detail: { code: 'household_required', message: 'X-Household-ID missing' } }),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await expect(libraryClient.get('api/v1/library/items').json()).rejects.toBeTruthy()
    expect(listener).toHaveBeenCalledWith({ code: 'household_required', householdId: null })
    unsubscribe()
  })
})
