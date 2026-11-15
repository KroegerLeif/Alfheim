import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getRequestErrorMessage, subscribeHouseholdErrors } from '@alfheim/shared'
import { workoutClient } from '../api'

/** The request the shared client passed to `fetch` as (url, init), as a `Request`. */
function toRequest(call: unknown[]): Request {
  return new Request(String(call[0]), call[1] as RequestInit)
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('workoutClient household context', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchSpy = vi.fn().mockImplementation(async () => jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends X-Household-ID for the active household and never X-Household-Role', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    await workoutClient.get('plans').json()
    const request = toRequest(fetchSpy.mock.calls[0])
    expect(request.headers.get('X-Household-ID')).toBe('hh-7')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('omits the header when no household is active', async () => {
    await workoutClient.get('plans').json()
    const request = toRequest(fetchSpy.mock.calls[0])
    expect(request.headers.get('X-Household-ID')).toBeNull()
  })

  it('reports household_forbidden and surfaces the structured error code', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    fetchSpy.mockImplementation(async () =>
      jsonResponse(403, { detail: { code: 'household_forbidden', message: 'Not a member' } }),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await expect(workoutClient.get('plans').json()).rejects.toMatchObject({
      status: 403,
      code: 'household_forbidden',
      message: 'Not a member',
    })
    expect(listener).toHaveBeenCalledWith({ code: 'household_forbidden', householdId: 'hh-7' })
    unsubscribe()
  })
})

describe('workoutClient network failures', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects with the browser error instead of a normalized API error', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    const error = await workoutClient.get('plans').json().catch((err: unknown) => err)
    expect(error).toBeInstanceOf(TypeError)
    expect(error).not.toHaveProperty('status')
    expect(error).not.toHaveProperty('code')
  })

  it('keeps the browser message for text shown to the user', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    const error = await workoutClient.get('plans').json().catch((err: unknown) => err)
    expect(getRequestErrorMessage(error)).toBe('Failed to fetch')
  })
})
