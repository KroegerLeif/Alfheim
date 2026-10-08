import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ChecklistContainer } from '../ChecklistContainer'
import { createQueryWrapper, createTestQueryClient } from '@/tests/utils'
import { server } from '@/tests/mocks/server'
import { makeItem } from '@/tests/mocks/handlers'
import { shoppingKeys } from '../../services/shoppingListService'
import type { ShoppingList } from '../../types'

const LIST_ID = '11111111-1111-4111-a111-111111111111'

function listWith(items: ReturnType<typeof makeItem>[]): ShoppingList {
  const now = new Date().toISOString()
  return {
    id: LIST_ID,
    name: 'Weekly',
    home_id: '33333333-3333-4333-a333-333333333333',
    owner_id: '44444444-4444-4444-a444-444444444444',
    is_default: true,
    is_personal: false,
    position: 0,
    created_at: now,
    updated_at: now,
    items: items as ShoppingList['items'],
  }
}

function serveList(items: ReturnType<typeof makeItem>[]) {
  server.use(http.get('*/api/v1/shopping-lists/:id', () => HttpResponse.json(listWith(items))))
}

describe('ChecklistContainer', () => {
  it('groups open items by category and lists completed ones separately', async () => {
    serveList([
      makeItem({ id: '55555555-5555-4555-a555-555555555551', name: 'Milk' }),
      makeItem({ id: '55555555-5555-4555-a555-555555555552', name: 'Bread', is_completed: true }),
    ])
    render(<ChecklistContainer listId={LIST_ID} />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('Dairy 🧀')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /completed \(1\)/i })).toBeInTheDocument()
    expect(screen.getByText('Bread')).toBeInTheDocument()
  })

  it('filters by the search text and can clear the search', async () => {
    serveList([
      makeItem({ id: '55555555-5555-4555-a555-555555555551', name: 'Milk' }),
      makeItem({ id: '55555555-5555-4555-a555-555555555553', name: 'Apple' }),
    ])
    render(<ChecklistContainer listId={LIST_ID} />, { wrapper: createQueryWrapper() })
    await screen.findByText('Milk')

    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: 'app' } })
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByText('Milk')).toBeInTheDocument()
  })

  it('blocks actions on an item the server does not know yet', async () => {
    const queryClient = createTestQueryClient()
    // Never resolves, so the query keeps the optimistic data the test seeds.
    server.use(http.get('*/api/v1/shopping-lists/:id', () => new Promise(() => undefined)))
    queryClient.setQueryData(
      shoppingKeys.list(LIST_ID),
      listWith([makeItem({ id: 'temp-0b1c2d3e-0000-4000-a000-000000000000', name: 'Pending Bread' })])
    )
    render(<ChecklistContainer listId={LIST_ID} />, { wrapper: createQueryWrapper(queryClient) })

    await screen.findByText('Pending Bread')
    expect(screen.getByRole('button', { name: 'Mark as checked' })).toBeDisabled()
    fireEvent.click(screen.getByText('Pending Bread'))
    expect(screen.queryByRole('button', { name: 'Remove item' })).not.toBeInTheDocument()
  })

  it('toggles a persisted item', async () => {
    let patched: Record<string, unknown> | null = null
    serveList([makeItem({ id: '55555555-5555-4555-a555-555555555551', name: 'Milk' })])
    server.use(
      http.patch('*/api/v1/shopping-lists/:id/items/:itemId', async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeItem({ is_completed: true }))
      })
    )
    render(<ChecklistContainer listId={LIST_ID} />, { wrapper: createQueryWrapper() })
    await screen.findByText('Milk')

    fireEvent.click(screen.getByRole('button', { name: 'Mark as checked' }))

    await waitFor(() => expect(patched).toEqual({ is_completed: true }))
  })

  it('shows a localized message when the list cannot be loaded', async () => {
    server.use(http.get('*/api/v1/shopping-lists/:id', () => HttpResponse.json({ detail: 'x' }, { status: 500 })))
    render(<ChecklistContainer listId={LIST_ID} />, { wrapper: createQueryWrapper() })
    expect(await screen.findByText('Failed to load shopping list details.')).toBeInTheDocument()
  })

  it('renders items with very long names and notes without breaking the layout', async () => {
    const name = 'Bio-Hafermilch-Barista-Edition-ohne-Zuckerzusatz-'.repeat(8)
    serveList([makeItem({ id: '55555555-5555-4555-a555-555555555551', name, brand: 'Marke'.repeat(20), quantity: 12345.5 })])
    render(<ChecklistContainer listId={LIST_ID} />, { wrapper: createQueryWrapper() })

    const label = await screen.findByTitle(new RegExp(`^${name.slice(0, 20)}`))
    expect(label).toHaveClass('truncate')
    expect(label.closest('[class*="minmax(0,1fr)"]')).not.toBeNull()
  })
})
