import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider, StaticHouseholdProvider } from '@alfheim/shared'

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
  options?: Omit<RenderOptions, 'wrapper'> & { role?: string },
  language: 'en' | 'de' | 'pl' = 'en'
) {
  const { role = 'OWNER', ...renderOptions } = options ?? {}
  const testQueryClient = createTestQueryClient()
  return render(
    <StaticHouseholdProvider householdId="hh-1" value={{ role }}>
      <QueryClientProvider client={testQueryClient}>
        <LanguageProvider defaultLanguage={language}>{ui}</LanguageProvider>
      </QueryClientProvider>
    </StaticHouseholdProvider>,
    renderOptions
  )
}
