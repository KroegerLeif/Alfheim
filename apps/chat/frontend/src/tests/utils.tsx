import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return QueryWrapper
}
