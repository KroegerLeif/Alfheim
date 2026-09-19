import React from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider, subscribeHouseholdErrors } from '@alfheim/shared'
import { pantryClient } from '../api'
import { useLowStockItems } from '@/features/inventory/services/inventoryService'

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
    await pantryClient.get('api/v1/products').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-42')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('reports household_forbidden to the household provider', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-42')
    fetchSpy.mockResolvedValue(jsonResponse(403, { detail: { code: 'household_forbidden', message: 'nope' } }))
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await expect(pantryClient.get('api/v1/products').json()).rejects.toBeTruthy()
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
})
