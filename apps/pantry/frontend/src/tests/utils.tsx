import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider } from '@alfheim/shared'

/**
 * Creates a wrapping QueryClientProvider wrapper for testing TanStack Query hooks,
 * with a ready active household (`hh-test`).
 */
export function createQueryWrapper(householdId: string | null = 'hh-test') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Prevents tests from waiting on retries
        gcTime: 0,    // Cleans up cache instantly
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <StaticHouseholdProvider householdId={householdId}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticHouseholdProvider>
  )
}
