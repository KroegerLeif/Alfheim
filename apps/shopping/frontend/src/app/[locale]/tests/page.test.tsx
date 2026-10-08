import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import ShoppingDashboard from '../page'
import { createQueryWrapper } from '@/tests/utils'
import { server } from '@/tests/mocks/server'

const BREAD_ID = '56565656-5656-4565-a565-565656565656'

async function openDashboard() {
  render(<ShoppingDashboard />, { wrapper: createQueryWrapper() })
  expect(await screen.findByText('Bread')).toBeInTheDocument()
}

describe('ShoppingDashboard sync to Pantry', () => {
  it('tells the user when the sync fails and includes the server detail', async () => {
    server.use(
      http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', () =>
        HttpResponse.json(
          { detail: { error_code: 'shopping.error.pantry_service_unavailable', message: 'Pantry service returned status code 500.' } },
          { status: 400 }
        )
      )
    )
    await openDashboard()

    fireEvent.click(screen.getByRole('button', { name: /Pantry Transfer/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Pantry sync failed. Pantry service returned status code 500.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the stock-in dialog for the items Pantry could not match', async () => {
    server.use(
      http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', () =>
        HttpResponse.json({
          status: 'partial_success',
          synced_count: 0,
          unrecognized_count: 1,
          unrecognized_items: [
            {
              shopping_item_id: BREAD_ID,
              name: 'Bread',
              quantity: 1,
              unit: 'piece',
              reason: 'pantry.error.product_not_found',
            },
          ],
        })
      )
    )
    await openDashboard()

    fireEvent.click(screen.getByRole('button', { name: /Pantry Transfer/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('1 Unknown Items Found')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByText('Bread')).toBeInTheDocument())
  })

  it('renders the dashboard in German', async () => {
    const { setTestLocale } = await import('@/tests/locale')
    setTestLocale('de')
    render(<ShoppingDashboard />, { wrapper: createQueryWrapper() })
    expect(await screen.findByRole('button', { name: /Einkauf Einlagern/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Artikel suchen...')).toBeInTheDocument()
  })
})
