import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/tests/utils'
import { AnalyticsView } from '../AnalyticsView'

describe('AnalyticsView Feature Component', () => {
  it('renders loading state then analytics dashboard and passes accessibility checks', async () => {
    const { container } = renderWithProviders(<AnalyticsView />)

    expect(screen.getByText('compilingMetrics')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('compilingMetrics')).not.toBeInTheDocument()
    })

    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('subtitle')).toBeInTheDocument()
    expect(screen.getByText('consumptionTitle')).toBeInTheDocument()
    expect(screen.getByText('categoryTitle')).toBeInTheDocument()

    // Aggregated categories
    expect(screen.getByText('DAIRY')).toBeInTheDocument()
    expect(screen.getByText('GRAINS')).toBeInTheDocument()

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders empty data state when no inventory or transactions exist', async () => {
    server.use(
      http.get('*/api/v1/inventory/state', () => HttpResponse.json([])),
      http.get('*/api/v1/inventory/transactions', () => HttpResponse.json([]))
    )

    renderWithProviders(<AnalyticsView />)

    await waitFor(() => {
      expect(screen.queryByText('compilingMetrics')).not.toBeInTheDocument()
    })

    expect(screen.getByText('noData')).toBeInTheDocument()
    expect(screen.getByText('noStockData')).toBeInTheDocument()
  })

  it('handles network error gracefully', async () => {
    server.use(
      http.get('*/api/v1/inventory/state', () => new HttpResponse(null, { status: 500 })),
      http.get('*/api/v1/categories', () => new HttpResponse(null, { status: 500 })),
      http.get('*/api/v1/inventory/transactions', () => new HttpResponse(null, { status: 500 }))
    )

    renderWithProviders(<AnalyticsView />)

    await waitFor(() => {
      expect(screen.queryByText('compilingMetrics')).not.toBeInTheDocument()
    })

    expect(screen.getByText('noData')).toBeInTheDocument()
    expect(screen.getByText('noStockData')).toBeInTheDocument()
  })
})
