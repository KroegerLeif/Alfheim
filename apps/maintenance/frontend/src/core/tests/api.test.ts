import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { subscribeHouseholdErrors } from '@alfheim/shared'
import { maintenanceClient } from '../api'
import { createDevice, getDevices } from '@/features/devices/api/devicesApi'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('maintenanceClient household context', () => {
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
    await maintenanceClient.get('devices').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-7')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('omits the header when no household is active', async () => {
    await maintenanceClient.get('devices').json()
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
    await expect(maintenanceClient.get('devices').json()).rejects.toMatchObject({
      status: 403,
      code: 'household_forbidden',
      message: 'Not a member',
    })
    expect(listener).toHaveBeenCalledWith({ code: 'household_forbidden', householdId: 'hh-7' })
    unsubscribe()
  })

  it('scopes device reads by header only (no household_id param, no /households call)', async () => {
    localStorage.setItem('alfheim_active_household_id', '33333333-3333-4333-a333-333333333333')
    await getDevices()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(new URL(request.url).searchParams.has('household_id')).toBe(false)
    expect(request.headers.get('X-Household-ID')).toBe('33333333-3333-4333-a333-333333333333')
    expect(fetchSpy.mock.calls.some((c) => String((c[0] as Request).url).includes('/households'))).toBe(false)
  })

  it('creates a device in the chosen household via an explicit X-Household-ID', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-active')
    let body: unknown
    fetchSpy.mockImplementation(async (req: Request) => {
      body = await req.clone().json()
      return jsonResponse(200, { id: 1 })
    })
    await createDevice(
      { name: 'n', model: 'm', serial: 's', category: 'c', location: 'l', status: 'active', steps: [] },
      'hh-target',
    )
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-target')
    expect(body).toMatchObject({ name: 'n' })
    expect(body).not.toHaveProperty('household_id')
  })
})
