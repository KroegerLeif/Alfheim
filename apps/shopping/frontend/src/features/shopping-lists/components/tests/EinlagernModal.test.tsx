import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { EinlagernModal } from '../EinlagernModal'
import { createQueryWrapper } from '@/tests/utils'
import { server } from '@/tests/mocks/server'
import { PANTRY_PRODUCT_ID, makeItem } from '@/tests/mocks/handlers'
import { UnrecognizedShoppingItem } from '../../types'

const LIST_ID = '11111111-1111-4111-a111-111111111111'
const ITEM_1_ID = '55555555-5555-4555-a555-555555555555'
const ITEM_2_ID = '88888888-8888-4888-a888-888888888888'

const mockUnrecognizedItems: UnrecognizedShoppingItem[] = [
  {
    shopping_item_id: ITEM_1_ID,
    name: 'Oat Milk',
    brand: 'Oatly',
    barcode: '7350083730007',
    quantity: 2,
    unit: 'l',
    reason: 'pantry.error.product_not_found',
  },
  {
    shopping_item_id: ITEM_2_ID,
    name: 'Bio Eggs',
    quantity: 10,
    unit: 'piece',
    reason: 'pantry.error.product_not_found',
  },
]

function renderModal(onClose = vi.fn()) {
  render(<EinlagernModal listId={LIST_ID} initialItems={mockUnrecognizedItems} onClose={onClose} />, {
    wrapper: createQueryWrapper(),
  })
  return onClose
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('.rounded-xl') as HTMLElement
}

/** Opens the catalog form of a row, types the catalog name and confirms. */
function saveToCatalog(name: string, catalogName: string) {
  const row = rowOf(name)
  fireEvent.click(within(row).getByRole('button', { name: 'Save to Catalog' }))
  fireEvent.change(within(row).getByLabelText('Catalog Product Name:'), { target: { value: catalogName } })
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
}

describe('EinlagernModal Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = render(
      <EinlagernModal listId={LIST_ID} initialItems={mockUnrecognizedItems} onClose={vi.fn()} />,
      { wrapper: createQueryWrapper() }
    )
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders the unresolved count and closes via the later button', async () => {
    const handleClose = renderModal()

    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()
    expect(screen.getByText('Oat Milk')).toBeInTheDocument()
    expect(screen.getByText('Bio Eggs')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Do Later' }))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('lets items be skipped until all are resolved and closes without another sync', async () => {
    let syncCalls = 0
    server.use(
      http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', () => {
        syncCalls += 1
        return HttpResponse.json({ status: 'success', synced_count: 0, unrecognized_count: 0, unrecognized_items: [] })
      })
    )
    const handleClose = renderModal()
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Skip Item' })[0])
    expect(screen.getByText('1 Unknown Items Found')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Skip Item' })[0])

    expect(await screen.findByText('All Items Processed')).toBeInTheDocument()
    expect(screen.getByText('0 saved · 2 ignored')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(handleClose).toHaveBeenCalled()
    expect(syncCalls).toBe(0)
  })

  it('saves to the catalog end to end: creates the product, renames the item and retries only that item', async () => {
    const calls: string[] = []
    let productBody: Record<string, unknown> = {}
    let patchBody: Record<string, unknown> = {}
    let syncBody: Record<string, unknown> = {}
    server.use(
      http.post('*/api/v1/products', async ({ request }) => {
        calls.push('create-product')
        productBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          id: PANTRY_PRODUCT_ID,
          name: productBody.name,
          base_unit: productBody.base_unit,
          minimum_stock: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }),
      http.patch('*/api/v1/shopping-lists/:id/items/:itemId', async ({ request, params }) => {
        calls.push('rename-item')
        patchBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeItem({ ...patchBody, id: params.itemId }))
      }),
      http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', async ({ request }) => {
        calls.push('retry-sync')
        syncBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ status: 'success', synced_count: 1, unrecognized_count: 0, unrecognized_items: [] })
      })
    )
    renderModal()
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()

    saveToCatalog('Oat Milk', 'Oatly Barista Oat Drink')

    await waitFor(() => expect(screen.getByText('1 Unknown Items Found')).toBeInTheDocument())
    expect(calls).toEqual(['create-product', 'rename-item', 'retry-sync'])
    expect(productBody).toMatchObject({
      name: 'Oatly Barista Oat Drink',
      brand: 'Oatly',
      barcode: '7350083730007',
      base_unit: 'ml',
    })
    expect(patchBody).toEqual({ name: 'Oatly Barista Oat Drink' })
    expect(syncBody).toEqual({ item_ids: [ITEM_1_ID] })
  })

  it('does not rename the item when the catalog name is unchanged', async () => {
    const calls: string[] = []
    server.use(
      http.patch('*/api/v1/shopping-lists/:id/items/:itemId', () => {
        calls.push('rename-item')
        return HttpResponse.json(makeItem())
      }),
      http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', () => {
        calls.push('retry-sync')
        return HttpResponse.json({ status: 'success', synced_count: 1, unrecognized_count: 0, unrecognized_items: [] })
      })
    )
    renderModal()
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()

    saveToCatalog('Bio Eggs', 'Bio Eggs')

    await waitFor(() => expect(screen.getByText('1 Unknown Items Found')).toBeInTheDocument())
    expect(calls).toEqual(['retry-sync'])
  })

  it('shows the server detail and lets the user retry when creating the product fails', async () => {
    let attempts = 0
    server.use(
      http.post('*/api/v1/products', () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.json({ detail: 'Barcode already exists.' }, { status: 409 })
          : HttpResponse.json({
              id: PANTRY_PRODUCT_ID,
              name: 'Oat Milk',
              base_unit: 'ml',
              minimum_stock: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
      })
    )
    renderModal()
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()

    saveToCatalog('Oat Milk', 'Oat Milk')

    const row = rowOf('Oat Milk')
    expect(await within(row).findByRole('alert')).toHaveTextContent(
      'Could not create the catalog entry. Barcode already exists.'
    )
    expect(screen.getByText('2 Unknown Items Found')).toBeInTheDocument()

    fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('1 Unknown Items Found')).toBeInTheDocument())
  })

  it('does not create the product twice when only the stock-in retry failed', async () => {
    let productCreations = 0
    let syncAttempts = 0
    server.use(
      http.post('*/api/v1/products', () => {
        productCreations += 1
        return HttpResponse.json({
          id: PANTRY_PRODUCT_ID,
          name: 'Bio Eggs',
          base_unit: 'piece',
          minimum_stock: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }),
      http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', () => {
        syncAttempts += 1
        return syncAttempts === 1
          ? HttpResponse.json({ detail: { error_code: 'x', message: 'Pantry service returned status code 500.' } }, { status: 400 })
          : HttpResponse.json({ status: 'success', synced_count: 1, unrecognized_count: 0, unrecognized_items: [] })
      })
    )
    renderModal()
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()

    saveToCatalog('Bio Eggs', 'Bio Eggs')
    const row = rowOf('Bio Eggs')
    expect(await within(row).findByRole('alert')).toHaveTextContent(
      'The catalog entry was created, but stocking the item failed. Pantry service returned status code 500.'
    )

    fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('1 Unknown Items Found')).toBeInTheDocument())
    expect(productCreations).toBe(1)
    expect(syncAttempts).toBe(2)
  })

  it('explains why Pantry still cannot place an item instead of marking it saved', async () => {
    server.use(
      http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', () =>
        HttpResponse.json({
          status: 'partial_success',
          synced_count: 0,
          unrecognized_count: 1,
          unrecognized_items: [{ ...mockUnrecognizedItems[1], reason: 'pantry.error.invalid_unit' }],
        })
      )
    )
    renderModal()
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()

    saveToCatalog('Bio Eggs', 'Bio Eggs')

    expect(await within(rowOf('Bio Eggs')).findByRole('alert')).toHaveTextContent(
      'Pantry does not know the unit of this item.'
    )
    expect(screen.getByText('2 Unknown Items Found')).toBeInTheDocument()
  })

  it('only marks an item as ignored after it was removed from the list', async () => {
    server.use(
      http.delete('*/api/v1/shopping-lists/:id/items/:itemId', () =>
        HttpResponse.json({ detail: 'Shopping item not found.' }, { status: 404 })
      )
    )
    renderModal()
    expect(await screen.findByText('2 Unknown Items Found')).toBeInTheDocument()

    fireEvent.click(within(rowOf('Bio Eggs')).getByRole('button', { name: 'Ignore' }))

    // The failed delete is announced and the item stays pending.
    expect(await screen.findByText('Could not remove the item. Shopping item not found.')).toBeInTheDocument()
    expect(screen.getByText('2 Unknown Items Found')).toBeInTheDocument()
  })

  it('renders its text in German', async () => {
    const { setTestLocale } = await import('@/tests/locale')
    setTestLocale('de')
    renderModal()
    expect(await screen.findByText('2 Unbekannte Artikel gefunden')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Später erledigen' })).toBeInTheDocument()
  })
})
