import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HouseholdProvider, StaticHouseholdProvider, useActiveHousehold } from '../HouseholdProvider'
import { ACTIVE_HOUSEHOLD_STORAGE_KEY, HOUSEHOLD_CHANGED_EVENT, reportHouseholdError } from '../householdStore'
import type { OidcWindow } from '../householdApi'

const households = [
  { id: 'hh-1', name: 'Main', slug: 'main', role: 'MEMBER', is_default: false },
  { id: 'hh-2', name: 'Summer', slug: 'summer', role: 'OWNER', is_default: true },
]

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HouseholdProvider tokenRetries={0}>{children}</HouseholdProvider>
)

describe('HouseholdProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('alfheim_access_token', 'tkn')
    delete (window as unknown as OidcWindow).__alfheim_oidc_instance__
  })
  afterEach(() => vi.restoreAllMocks())

  it('goes from loading to ready and selects the default household', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok(households))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/households/me', { headers: { Authorization: 'Bearer tkn' } })
    expect(result.current.householdId).toBe('hh-2')
    expect(result.current.role).toBe('OWNER')
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBe('hh-2')
  })

  it('keeps a saved membership over the default', async () => {
    localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-1')
    vi.spyOn(global, 'fetch').mockResolvedValue(ok(households))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.householdId).toBe('hh-1')
  })

  it('reports none and clears a stale id when the user has no households', async () => {
    localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'stale')
    vi.spyOn(global, 'fetch').mockResolvedValue(ok([]))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('none'))
    expect(result.current.householdId).toBeNull()
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBeNull()
  })

  it('reports error when the household service fails and nothing is cached', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response)
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('reports error without a token', async () => {
    sessionStorage.clear()
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('refreshes the OIDC token once on 401', async () => {
    ;(window as unknown as OidcWindow).__alfheim_oidc_instance__ = {
      token: 'fresh',
      updateToken: vi.fn().mockResolvedValue(true),
    }
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response)
      .mockResolvedValueOnce(ok(households))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('syncs cross-tab storage events and same-tab switches', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(ok(households))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.householdId).toBe('hh-2'))

    act(() => {
      localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-1')
      window.dispatchEvent(new StorageEvent('storage', { key: ACTIVE_HOUSEHOLD_STORAGE_KEY, newValue: 'hh-1' }))
    })
    expect(result.current.householdId).toBe('hh-1')

    act(() => result.current.setActiveHousehold('hh-2'))
    expect(result.current.householdId).toBe('hh-2')
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBe('hh-2')
  })

  it('refetches when another app announces a household it did not know', async () => {
    const created = { id: 'hh-3', name: 'New', slug: 'new', role: 'OWNER' }
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(ok(households))
      .mockResolvedValueOnce(ok([...households, created]))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-3')
      window.dispatchEvent(new Event(HOUSEHOLD_CHANGED_EVENT))
    })
    await waitFor(() => expect(result.current.householdId).toBe('hh-3'))
    expect(result.current.households).toHaveLength(3)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('hydrates from cache before the fetch resolves', async () => {
    localStorage.setItem('alfheim_cached_households', JSON.stringify(households))
    localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-1')
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.householdId).toBe('hh-1')
  })

  it('exposes backend errors for the active household until it changes', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(ok(households))
    const { result } = renderHook(() => useActiveHousehold(), { wrapper })
    await waitFor(() => expect(result.current.householdId).toBe('hh-2'))

    act(() => reportHouseholdError('household_forbidden', 'hh-2'))
    expect(result.current.error).toBe('household_forbidden')
    act(() => result.current.setActiveHousehold('hh-1'))
    expect(result.current.error).toBeNull()
  })

  it('throws outside a provider and nests as pass-through', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useActiveHousehold())).toThrow(/HouseholdProvider/)

    vi.spyOn(global, 'fetch').mockResolvedValue(ok(households))
    const nested = ({ children }: { children: React.ReactNode }) => (
      <HouseholdProvider tokenRetries={0}>
        <HouseholdProvider>{children}</HouseholdProvider>
      </HouseholdProvider>
    )
    const { result } = renderHook(() => useActiveHousehold(), { wrapper: nested })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('StaticHouseholdProvider', () => {
  it('provides a ready context and writes the id to storage', () => {
    const { result } = renderHook(() => useActiveHousehold(), {
      wrapper: ({ children }) => <StaticHouseholdProvider householdId="hh-x">{children}</StaticHouseholdProvider>,
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.householdId).toBe('hh-x')
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBe('hh-x')
  })

  it('reports none without a household', () => {
    const { result } = renderHook(() => useActiveHousehold(), {
      wrapper: ({ children }) => <StaticHouseholdProvider householdId={null}>{children}</StaticHouseholdProvider>,
    })
    expect(result.current.status).toBe('none')
  })
})
