import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider } from '@alfheim/shared'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const testQueryClient = createTestQueryClient()
  return render(
    <StaticHouseholdProvider householdId="hh-1">
      <QueryClientProvider client={testQueryClient}>
        {ui}
      </QueryClientProvider>
    </StaticHouseholdProvider>,
    options
  )
}

/**
 * Creates a wrapping QueryClientProvider wrapper for testing TanStack Query hooks.
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Prevents tests from waiting on retries
        gcTime: 0,    // Cleans up cache instantly
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <StaticHouseholdProvider householdId="hh-1"><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></StaticHouseholdProvider>
  )
}
