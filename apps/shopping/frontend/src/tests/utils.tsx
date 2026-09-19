import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider } from '@alfheim/shared'

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
    <StaticHouseholdProvider householdId="33333333-3333-4333-a333-333333333333">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticHouseholdProvider>
  )
}
