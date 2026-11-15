import React from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider, getRequestErrorMessage, subscribeHouseholdErrors } from '@alfheim/shared'
import { pantryClient, shoppingClient } from '../api'
import { useLowStockItems } from '@/features/inventory/services/inventoryService'

/** The request the shared client passed to `fetch` as (url, init), as a `Request`. */
function toRequest(call: unknown[]): Request {
  return new Request(String(call[0]), call[1] as RequestInit)
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('pantryClient household context', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends X-Household-ID for the active household and never X-Household-Role', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-42')
    await pantryClient.get('products').json()
    const request = toRequest(fetchSpy.mock.calls[0])
    expect(request.headers.get('X-Household-ID')).toBe('hh-42')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('reports household_forbidden to the household provider', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-42')
    fetchSpy.mockResolvedValue(jsonResponse(403, { detail: { code: 'household_forbidden', message: 'nope' } }))
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await expect(pantryClient.get('products').json()).rejects.toBeTruthy()
    expect(listener).toHaveBeenCalledWith({ code: 'household_forbidden', householdId: 'hh-42' })
    unsubscribe()
  })

  it('does not query before a household is ready', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StaticHouseholdProvider householdId={null} value={{ status: 'loading' }}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticHouseholdProvider>
    )
    const { result } = renderHook(() => useLowStockItems(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reaches the shopping API on the public ingress prefix with token and household', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-42')
    sessionStorage.setItem('alfheim_access_token', 'token-9')
    await shoppingClient.post('shopping/items', { name: 'Milk' }).json()
    const request = toRequest(fetchSpy.mock.calls[0])
    expect(new URL(request.url).pathname).toBe('/shopping/api/v1/shopping/items')
    expect(request.headers.get('X-Household-ID')).toBe('hh-42')
  })
})

describe('pantryClient network failures', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects with the browser error instead of a normalized API error', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    const error = await pantryClient.get('products').json().catch((err: unknown) => err)
    expect(error).toBeInstanceOf(TypeError)
    expect(error).not.toHaveProperty('status')
    expect(error).not.toHaveProperty('code')
  })

  it('keeps the browser message for text shown to the user', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
    const error = await pantryClient.get('products').json().catch((err: unknown) => err)
    expect(getRequestErrorMessage(error)).toBe('Failed to fetch')
  })
})
