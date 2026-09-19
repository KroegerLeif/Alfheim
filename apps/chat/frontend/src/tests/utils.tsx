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

  function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <StaticHouseholdProvider householdId="hh-1"><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></StaticHouseholdProvider>
  }

  return QueryWrapper
}
