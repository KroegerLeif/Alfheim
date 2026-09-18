import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ACTIVE_HOUSEHOLD_STORAGE_KEY,
  HOUSEHOLD_CHANGED_EVENT,
  applyHouseholdHeaders,
  getActiveHouseholdId,
  getHouseholdErrorCode,
  householdHeaders,
  isHouseholdAccessError,
  parseApiErrorBody,
  pickActiveHousehold,
  readHouseholdErrorCode,
  reportHouseholdErrorResponse,
  setActiveHouseholdId,
  subscribeHouseholdErrors,
} from '../householdStore'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('householdStore', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('builds only the X-Household-ID header', () => {
    expect(householdHeaders('hh-1')).toEqual({ 'X-Household-ID': 'hh-1' })
    expect(householdHeaders(null)).toEqual({})
    localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-9')
    expect(householdHeaders()).toEqual({ 'X-Household-ID': 'hh-9' })
  })

  it('applies headers to a Headers instance and strips X-Household-Role', () => {
    const headers = new Headers({ 'X-Household-Role': 'OWNER' })
    applyHouseholdHeaders(headers, 'hh-1')
    expect(headers.get('X-Household-ID')).toBe('hh-1')
    expect(headers.get('X-Household-Role')).toBeNull()
    applyHouseholdHeaders(headers, null)
    expect(headers.get('X-Household-ID')).toBeNull()
  })

  it('persists the active household and dispatches the change event only on change', () => {
    const spy = vi.fn()
    window.addEventListener(HOUSEHOLD_CHANGED_EVENT, spy)
    setActiveHouseholdId('hh-1')
    setActiveHouseholdId('hh-1')
    expect(getActiveHouseholdId()).toBe('hh-1')
    expect(spy).toHaveBeenCalledTimes(1)
    setActiveHouseholdId(null)
    expect(getActiveHouseholdId()).toBeNull()
    expect(spy).toHaveBeenCalledTimes(2)
    window.removeEventListener(HOUSEHOLD_CHANGED_EVENT, spy)
  })

  it('parses the backend household error contract', async () => {
    expect(getHouseholdErrorCode({ detail: { code: 'household_forbidden', message: 'x' } })).toBe('household_forbidden')
    expect(getHouseholdErrorCode({ detail: 'Not found' })).toBeNull()
    expect(getHouseholdErrorCode(null)).toBeNull()
    expect(await readHouseholdErrorCode(jsonResponse(503, { detail: { code: 'household_service_unavailable' } }))).toBe(
      'household_service_unavailable',
    )
    expect(await readHouseholdErrorCode(jsonResponse(404, { detail: { code: 'household_forbidden' } }))).toBeNull()
    expect(await readHouseholdErrorCode(new Response('oops', { status: 400 }))).toBeNull()
    expect(isHouseholdAccessError('household_invalid')).toBe(true)
    expect(isHouseholdAccessError('household_role_forbidden')).toBe(false)
  })

  it('reports household errors but leaves role errors to the caller', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await reportHouseholdErrorResponse(jsonResponse(403, { detail: { code: 'household_forbidden' } }), 'hh-1')
    expect(listener).toHaveBeenCalledWith({ code: 'household_forbidden', householdId: 'hh-1' })
    const code = await reportHouseholdErrorResponse(jsonResponse(403, { detail: { code: 'household_role_forbidden' } }))
    expect(code).toBe('household_role_forbidden')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('normalizes error bodies', () => {
    expect(parseApiErrorBody({ detail: { code: 'household_forbidden', message: 'No access' } })).toEqual({
      code: 'household_forbidden',
      message: 'No access',
    })
    expect(parseApiErrorBody({ detail: 'Not found' })).toEqual({ code: null, message: 'Not found' })
    expect(parseApiErrorBody({ message: 'boom', code: 'x' })).toEqual({ code: 'x', message: 'boom' })
    expect(parseApiErrorBody({ detail: [{ msg: 'bad' }], message: 'm' })).toEqual({ code: null, message: 'm' })
    expect(parseApiErrorBody('nope')).toEqual({ code: null, message: null })
  })

  it('picks saved, then default, then first household', () => {
    const list = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B', is_default: true },
    ]
    expect(pickActiveHousehold(list, 'a')?.id).toBe('a')
    expect(pickActiveHousehold(list, 'gone')?.id).toBe('b')
    expect(pickActiveHousehold([{ id: 'c', name: 'C' }], null)?.id).toBe('c')
    expect(pickActiveHousehold([], 'a')).toBeNull()
  })
})
