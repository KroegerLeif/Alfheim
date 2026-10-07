import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider, StaticHouseholdProvider, type Language } from '@alfheim/shared'

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

/** Render with the real dictionary of `language` (English by default, like the /en route). */
export function renderWithI18n(
  ui: ReactElement,
  language: Language = 'en',
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(<LanguageProvider defaultLanguage={language}>{ui}</LanguageProvider>, options)
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { language?: Language }
) {
  const { language = 'en', ...renderOptions } = options ?? {}
  const testQueryClient = createTestQueryClient()
  return render(
    <LanguageProvider defaultLanguage={language}>
      <StaticHouseholdProvider householdId="hh-1">
        <QueryClientProvider client={testQueryClient}>
          {ui}
        </QueryClientProvider>
      </StaticHouseholdProvider>
    </LanguageProvider>,
    renderOptions
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
    <LanguageProvider defaultLanguage="en">
      <StaticHouseholdProvider householdId="hh-1"><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></StaticHouseholdProvider>
    </LanguageProvider>
  )
}
