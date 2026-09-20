import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider } from '@alfheim/shared'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
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
