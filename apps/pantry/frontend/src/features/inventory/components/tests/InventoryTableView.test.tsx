import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/tests/utils'
import { InventoryTableView } from '../InventoryTableView'

describe('InventoryTableView Feature Component', () => {
  it('renders loading state initially when request is delayed and then displays inventory table', async () => {
    server.use(
      http.get('*/api/v1/inventory/state', async () => {
        await delay(100)
        return HttpResponse.json([
          {
            id: 'inv-1',
            household_id: 'hh-1',
            product_id: 'prod-1',
            location_id: 'loc-1',
            quantity: 1,
            earliest_expiration: '2025-12-31',
            product: {
              id: 'prod-1',
              household_id: 'hh-1',
              category_id: 'cat-1',
              name: 'Whole Milk',
              brand: 'Dairy Farm',
              barcode: '1234567890123',
              is_global: false,
              base_unit: 'liter',
              minimum_stock: 2,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
            },
            location: {
              id: 'loc-1',
              household_id: 'hh-1',
              name: 'Main Fridge',
              description: 'Kitchen primary refrigerator',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
            },
            last_updated: '2025-01-01T00:00:00Z',
          },
        ])
      })
    )

    renderWithProviders(<InventoryTableView />)

    expect(screen.getByText('Loading Registers...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('Loading Registers...')).not.toBeInTheDocument()
    })

    expect(screen.getByText('Stock Inventory')).toBeInTheDocument()
    expect(screen.getByText('Whole Milk')).toBeInTheDocument()
  })

  it('renders table content and passes accessibility checks', async () => {
    const { container } = renderWithProviders(<InventoryTableView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    expect(screen.getByText('Basmati Rice')).toBeInTheDocument()

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('filters inventory by product search query', async () => {
    const { user } = renderWithProviders(<InventoryTableView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('searchPlaceholder')
    await user.type(searchInput, 'Milk')

    expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    expect(screen.queryByText('Basmati Rice')).not.toBeInTheDocument()
  })

  it('filters inventory by selected category', async () => {
    const { user } = renderWithProviders(<InventoryTableView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    const categorySelect = screen.getByDisplayValue('All Categories')
    await user.selectOptions(categorySelect, 'cat-2')

    expect(screen.queryByText('Whole Milk')).not.toBeInTheDocument()
    expect(screen.getByText('Basmati Rice')).toBeInTheDocument()
  })

  it('renders empty state when no inventory items match filters', async () => {
    const { user } = renderWithProviders(<InventoryTableView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('searchPlaceholder')
    await user.type(searchInput, 'NonExistentItem')

    expect(screen.getByText('[ No Items Found ]')).toBeInTheDocument()
  })

  it('opens stock action modal on quick action button click', async () => {
    const { user } = renderWithProviders(<InventoryTableView />)

    await waitFor(() => {
      expect(screen.getByText('Whole Milk')).toBeInTheDocument()
    })

    const inButtons = screen.getAllByRole('button', { name: /actionIn/i })
    await user.click(inButtons[0])

    expect(screen.getByRole('heading', { name: 'transactionModalTitleIn' })).toBeInTheDocument()
  })

  it('handles network error gracefully', async () => {
    server.use(
      http.get('*/api/v1/inventory/state', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    renderWithProviders(<InventoryTableView />)

    await waitFor(() => {
      expect(screen.queryByText('Loading Registers...')).not.toBeInTheDocument()
    })

    expect(screen.getByText('[ No Items Found ]')).toBeInTheDocument()
  })
})
