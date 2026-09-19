import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api } from '../client'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('dashboard api client household header', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchSpy = vi.fn().mockImplementation(async () => jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the active household as X-Household-ID and never X-Household-Role', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-dash')
    await api.get('api/v1/apps').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-dash')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('omits the header without an active household', async () => {
    await api.get('api/v1/apps').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBeNull()
  })
})
