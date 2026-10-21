import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider } from '@alfheim/shared'
import { NotificationsProvider } from '@/components/shared/Notifications'

/** A QueryClient that neither retries nor keeps unused queries around. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Prevents tests from waiting on retries
        gcTime: 0,    // Cleans up cache instantly
      },
    },
  })
}

/**
 * Creates a wrapping QueryClientProvider wrapper for testing TanStack Query hooks.
 * Pass a client to seed or inspect the query cache from the test, and a household role to test
 * role-dependent controls (default OWNER).
 */
export function createQueryWrapper(queryClient: QueryClient = createTestQueryClient(), role = 'OWNER') {
  return ({ children }: { children: React.ReactNode }) => (
    <StaticHouseholdProvider householdId="33333333-3333-4333-a333-333333333333" value={{ role }}>
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>{children}</NotificationsProvider>
      </QueryClientProvider>
    </StaticHouseholdProvider>
  )
}
