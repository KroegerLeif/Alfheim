import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError, type NormalizedOptions } from 'ky'
import { LanguageProvider, StaticHouseholdProvider, type Language } from '@alfheim/shared'

/**
 * Creates a wrapper with the real dictionaries (English unless `language` says otherwise), a
 * QueryClientProvider for TanStack Query hooks and a ready active household (`hh-test`).
 */
export function createQueryWrapper(householdId: string | null = 'hh-test', language: Language = 'en') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Prevents tests from waiting on retries
        gcTime: 0,    // Cleans up cache instantly
      },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider defaultLanguage={language}>
      <StaticHouseholdProvider householdId={householdId}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticHouseholdProvider>
    </LanguageProvider>
  )
}

/** Renders `ui` inside the standard test providers. */
export function renderWithProviders(
  ui: ReactElement,
  { language, ...options }: { language?: Language } & Omit<RenderOptions, 'wrapper'> = {}
) {
  return render(ui, { wrapper: createQueryWrapper('hh-test', language), ...options })
}

/** Builds the error ky throws for a non-2xx response, with an optional JSON body. */
export function makeHttpError(status: number, body?: unknown): HTTPError {
  const response = new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
  return new HTTPError(response, new Request('http://localhost/api'), {} as NormalizedOptions)
}
