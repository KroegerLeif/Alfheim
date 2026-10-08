import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QuickAddGrid } from '../QuickAddGrid'
import { createQueryWrapper } from '@/tests/utils'
import { server } from '@/tests/mocks/server'
import { HISTORY_ENTRY_ID } from '@/tests/mocks/handlers'
import { setTestLocale } from '@/tests/locale'

describe('QuickAddGrid', () => {
  it('adds an entry with its stored unit when the tile is clicked', async () => {
    const onAdd = vi.fn()
    render(<QuickAddGrid onAdd={onAdd} />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole('button', { name: 'Oat Milk' }))

    expect(onAdd).toHaveBeenCalledWith('Oat Milk', 'l')
  })

  it('removes an entry through the delete endpoint without adding it to the list', async () => {
    const deleted: string[] = []
    server.use(
      http.delete('*/api/v1/shopping-history/:id', ({ params }) => {
        deleted.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      })
    )
    const onAdd = vi.fn()
    render(<QuickAddGrid onAdd={onAdd} />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole('button', { name: 'Remove "Oat Milk" from frequently bought' }))

    await waitFor(() => expect(deleted).toEqual([HISTORY_ENTRY_ID]))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('tells the user when the entry could not be removed', async () => {
    server.use(
      http.delete('*/api/v1/shopping-history/:id', () =>
        HttpResponse.json({ detail: 'History entry not found or unauthorized.' }, { status: 404 })
      )
    )
    render(<QuickAddGrid onAdd={vi.fn()} />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole('button', { name: 'Remove "Oat Milk" from frequently bought' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not remove the entry. History entry not found or unauthorized.'
    )
  })

  it('shows the remove label in the active locale', async () => {
    setTestLocale('de')
    render(<QuickAddGrid onAdd={vi.fn()} />, { wrapper: createQueryWrapper() })
    expect(
      await screen.findByRole('button', { name: '"Oat Milk" aus „Häufig gekauft“ entfernen' })
    ).toBeInTheDocument()
  })

  it('shows the empty state when there is no history', async () => {
    server.use(http.get('*/api/v1/shopping-history', () => HttpResponse.json([])))
    render(<QuickAddGrid onAdd={vi.fn()} />, { wrapper: createQueryWrapper() })
    expect(await screen.findByText('No frequent items')).toBeInTheDocument()
  })

  it('clips very long entry names', async () => {
    const name = 'Hafermilch Barista Edition ohne Zuckerzusatz '.repeat(5).trim()
    server.use(
      http.get('*/api/v1/shopping-history', () =>
        HttpResponse.json([
          {
            id: HISTORY_ENTRY_ID,
            home_id: '33333333-3333-4333-a333-333333333333',
            name,
            brand: '',
            barcode: null,
            unit: 'piece',
            purchase_count: 1,
            icon_tag: null,
            last_purchased_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
      )
    )
    render(<QuickAddGrid onAdd={vi.fn()} />, { wrapper: createQueryWrapper() })

    const label = await screen.findByText(name)
    expect(label).toHaveClass('truncate')
  })
})
