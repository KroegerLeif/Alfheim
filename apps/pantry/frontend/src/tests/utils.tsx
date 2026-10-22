import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError, NetworkError, type NormalizedOptions } from 'ky'
import { LanguageProvider, StaticHouseholdProvider, type Language } from '@alfheim/shared'

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

/** Builds the error ky throws for a non-2xx response, with an optional JSON body. */
export function makeHttpError(status: number, body?: unknown): HTTPError {
  const response = new Response(null, { status })
  const error = new HTTPError(response, new Request('http://localhost/api'), {} as NormalizedOptions)
  // ky parses the response body into `data` before it throws.
  error.data = body as HTTPError['data']
  return error
}

/** Builds the error ky throws when `fetch` fails without a response (offline, DNS, refused). */
export function makeNetworkError(): NetworkError {
  return new NetworkError(new Request('http://localhost/api'), { cause: new TypeError('Failed to fetch') })
}
