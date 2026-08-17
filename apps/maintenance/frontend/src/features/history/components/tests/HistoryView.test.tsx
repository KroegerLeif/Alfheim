import React from 'react'
import { screen, render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LayoutProvider } from '../../../../shared/layout/LayoutContext'
import { HistoryView } from '../HistoryView'
import * as useHistoryHook from '../../hooks/useHistory'

describe('HistoryView Component', () => {
  it('renders localized error message on error state', () => {
    vi.spyOn(useHistoryHook, 'useServiceHistory').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)

    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <LayoutProvider>
          <HistoryView />
        </LayoutProvider>
      </QueryClientProvider>
    )

    // With mock next-intl, t("history.load_error") returns "history.load_error"
    expect(screen.getByText('history.load_error')).toBeInTheDocument()
  })

  it('renders empty history placeholder when no events are logged', async () => {
    vi.spyOn(useHistoryHook, 'useServiceHistory').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    const queryClient = new QueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <LayoutProvider>
          <HistoryView />
        </LayoutProvider>
      </QueryClientProvider>
    )

    expect(screen.getByText('serviceHistory.noHistoryFound')).toBeInTheDocument()
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
