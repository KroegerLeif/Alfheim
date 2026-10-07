import React, { ComponentProps, ReactElement } from 'react'
import { vi } from 'vitest'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import {
  LanguageProvider,
  StaticHouseholdProvider,
  ThemeProvider,
  getSharedMessages,
  type Language,
} from '@alfheim/shared'
import { LayoutProvider } from '../shared/layout/LayoutContext'

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

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** UI language; the real en/de/pl dictionaries are loaded. */
  locale?: Language
  /** Query client to pre-populate with data. */
  queryClient?: QueryClient
  /** Overrides of the static household context, for example a list of households. */
  householdValue?: ComponentProps<typeof StaticHouseholdProvider>['value']
}

/**
 * Renders `ui` with the real production message dictionary. An unresolved or malformed message throws,
 * so a missing translation key fails the test instead of rendering a key fragment.
 */
export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { locale = 'en', queryClient, householdValue, ...renderOptions } = options
  const testQueryClient = queryClient ?? createTestQueryClient()
  const result = render(
    <StaticHouseholdProvider householdId="hh-1" value={householdValue}>
      <NextIntlClientProvider
        locale={locale}
        messages={getSharedMessages(locale)}
        onError={(error) => {
          throw error
        }}
      >
        <LanguageProvider defaultLanguage={locale}>
          <ThemeProvider defaultMode="dark" defaultVariant="nordic">
            <QueryClientProvider client={testQueryClient}>
              <LayoutProvider>{ui}</LayoutProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </LanguageProvider>
      </NextIntlClientProvider>
    </StaticHouseholdProvider>,
    renderOptions
  )
  return { ...result, queryClient: testQueryClient }
}

/**
 * Freezes "today" at local noon of the given calendar day (month is 1-based). Only `Date` is faked, so
 * timers, promises and Testing Library polling keep working. Undo with `vi.useRealTimers()`.
 */
export function mockToday(year: number, month: number, day: number, hour = 12) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(year, month - 1, day, hour))
}
