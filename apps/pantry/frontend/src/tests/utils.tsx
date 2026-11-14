import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError, LanguageProvider, StaticHouseholdProvider, type Language } from '@alfheim/shared'

/**
 * Creates a wrapper with the real dictionaries (English unless `language` says otherwise), a
 * QueryClientProvider for TanStack Query hooks and a ready active household (`hh-test`).
 */
export function createQueryWrapper(
  householdId: string | null = 'hh-test',
  language: Language = 'en',
  role: string = 'OWNER'
) {
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
      <StaticHouseholdProvider householdId={householdId} value={householdId ? { role } : undefined}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticHouseholdProvider>
    </LanguageProvider>
  )
}

/** Renders `ui` inside the standard test providers. */
export function renderWithProviders(
  ui: ReactElement,
  { language, role, ...options }: { language?: Language; role?: string } & Omit<RenderOptions, 'wrapper'> = {}
) {
  return render(ui, { wrapper: createQueryWrapper('hh-test', language, role), ...options })
}

/** Build the error the shared API client throws for a non-2xx response, with an optional JSON body. */
export function makeHttpError(status: number, body?: unknown): ApiError {
  return new ApiError(new Response(null, { status }), body)
}

/** Builds the error `fetch` throws when there is no response (offline, DNS, refused). */
export function makeNetworkError(): TypeError {
  return new TypeError('Failed to fetch')
}
