import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { createTestQueryClient } from '../../../../tests/test-utils'
import { useShoppingIntegration, useMaintenanceIntegration } from '../integrationService'

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('integrationService Hooks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    sessionStorage.clear()
    localStorage.clear()
    localStorage.setItem('alfheim_active_household_id', 'hh-test-123')
  })

  describe('useShoppingIntegration', () => {
    it('fetches shopping lists and correctly calculates total lists and pending item count', async () => {
      let authHeader: string | null = null
      let householdHeader: string | null = null

      server.use(
        http.get(/\/shopping-lists$/, ({ request }) => {
          authHeader = request.headers.get('Authorization')
          householdHeader = request.headers.get('X-Household-ID')
          return HttpResponse.json([
            {
              id: 'list-1',
              name: 'Groceries',
              items: [
                { id: 'item-1', name: 'Milk', is_completed: false },
                { id: 'item-2', name: 'Bread', is_completed: true },
                { id: 'item-3', name: 'Eggs', is_completed: false },
              ],
            },
            {
              id: 'list-2',
              name: 'Hardware',
              items: [
                { id: 'item-4', name: 'Screws', is_completed: false },
              ],
            },
          ])
        })
      )

      sessionStorage.setItem('token_chores-frontend', 'test-bearer-token')

      const { result } = renderHook(() => useShoppingIntegration(), {
        wrapper: createWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual({
        pendingCount: 3,
        totalLists: 2,
      })

      expect(authHeader).toBe('Bearer test-bearer-token')
      expect(householdHeader).toBe('hh-test-123')
    })

    it('handles empty response gracefully', async () => {
      server.use(
        http.get(/\/shopping-lists$/, () => {
          return HttpResponse.json([])
        })
      )

      const { result } = renderHook(() => useShoppingIntegration(), {
        wrapper: createWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual({
        pendingCount: 0,
        totalLists: 0,
      })
    })

    it('throws error when shopping lists endpoint returns HTTP error', async () => {
      server.use(
        http.get(/\/shopping-lists$/, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const { result } = renderHook(() => useShoppingIntegration(), {
        wrapper: createWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error?.message).toBe('Failed to fetch shopping lists')
    })
  })

  describe('useMaintenanceIntegration', () => {
    it('fetches maintenance summary and calculates total devices and due items', async () => {
      let authHeader: string | null = null
      let householdHeader: string | null = null

      server.use(
        http.get(/\/maintenance\/summary$/, ({ request }) => {
          authHeader = request.headers.get('Authorization')
          householdHeader = request.headers.get('X-Household-ID')
          return HttpResponse.json([
            {
              total_devices: 3,
              total_overdue: 1,
              total_due_soon: 2,
            },
            {
              total_devices: 2,
              total_overdue: 0,
              total_due_soon: 1,
            },
          ])
        })
      )

      sessionStorage.setItem('token_chores-frontend', 'test-bearer-token')

      const { result } = renderHook(() => useMaintenanceIntegration(), {
        wrapper: createWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual({
        dueCount: 4,
        totalDevices: 5,
      })

      expect(authHeader).toBe('Bearer test-bearer-token')
      expect(householdHeader).toBe('hh-test-123')
    })

    it('handles empty array summary gracefully', async () => {
      server.use(
        http.get(/\/maintenance\/summary$/, () => {
          return HttpResponse.json([])
        })
      )

      const { result } = renderHook(() => useMaintenanceIntegration(), {
        wrapper: createWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual({
        dueCount: 0,
        totalDevices: 0,
      })
    })

    it('throws error when maintenance summary endpoint returns HTTP error', async () => {
      server.use(
        http.get(/\/maintenance\/summary$/, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const { result } = renderHook(() => useMaintenanceIntegration(), {
        wrapper: createWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error?.message).toBe('Failed to fetch maintenance summary')
    })
  })
})
