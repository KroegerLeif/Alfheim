import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { subscribeHouseholdErrors } from '@alfheim/shared'
import { workoutClient } from '../api'

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
    await workoutClient.get('api/v1/plans').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-7')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('omits the header when no household is active', async () => {
    await workoutClient.get('api/v1/plans').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBeNull()
  })

  it('reports household_forbidden and surfaces the structured error code', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    fetchSpy.mockImplementation(async () =>
      jsonResponse(403, { detail: { code: 'household_forbidden', message: 'Not a member' } }),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await expect(workoutClient.get('api/v1/plans').json()).rejects.toMatchObject({
      status: 403,
      code: 'household_forbidden',
      message: 'Not a member',
    })
    expect(listener).toHaveBeenCalledWith({ code: 'household_forbidden', householdId: 'hh-7' })
    unsubscribe()
  })
})
