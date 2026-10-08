import React from 'react'
import { renderHook, act, waitFor, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { useAddShoppingItem, useUpdateShoppingItem, useDeleteShoppingItem, isPendingItem } from '../shoppingItemService'
import { shoppingKeys } from '../shoppingListService'
import { createQueryWrapper, createTestQueryClient } from '@/tests/utils'
import { server } from '@/tests/mocks/server'
import { makeItem } from '@/tests/mocks/handlers'
import type { ShoppingList } from '../../types'

const LIST_ID = '11111111-1111-4111-a111-111111111111'
const EXISTING_ID = '55555555-5555-4555-a555-555555555555'
const SERVER_ID = '12121212-1212-4121-a121-121212121212'

function seededList(): ShoppingList {
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
    items: [makeItem({ id: EXISTING_ID, list_id: LIST_ID })] as ShoppingList['items'],
  }
}

function setup() {
  const queryClient = createTestQueryClient()
  // The seeded list has no observer, so keep it from being garbage collected immediately.
  queryClient.setQueryDefaults(shoppingKeys.list(LIST_ID), { gcTime: Infinity })
  queryClient.setQueryData(shoppingKeys.list(LIST_ID), seededList())
  const wrapper = createQueryWrapper(queryClient)
  const items = () => queryClient.getQueryData<ShoppingList>(shoppingKeys.list(LIST_ID))!.items
  return { queryClient, wrapper, items }
}

describe('useAddShoppingItem', () => {
  it('marks the optimistic item as pending until the server confirms it, then swaps in the real item', async () => {
    server.use(
      http.post('*/api/v1/shopping-lists/:id/items', async () => {
        await delay(50)
        return HttpResponse.json(makeItem({ id: SERVER_ID, list_id: LIST_ID, name: 'Bread' }), { status: 201 })
      })
    )
    const { wrapper, items } = setup()
    const { result } = renderHook(() => useAddShoppingItem(LIST_ID), { wrapper })

    act(() => {
      result.current.mutate({ name: 'Bread', quantity: 1, unit: 'stk' })
    })

    await waitFor(() => expect(items()).toHaveLength(2))
    const optimistic = items()[0]
    expect(optimistic.name).toBe('Bread')
    expect(isPendingItem(optimistic)).toBe(true)
    expect(optimistic.id.startsWith('temp-')).toBe(true)
    expect(isPendingItem(items()[1])).toBe(false)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await waitFor(() => expect(items().some((item) => item.id === SERVER_ID)).toBe(true))
    expect(items().some(isPendingItem)).toBe(false)
  })

  it('rolls the optimistic item back and tells the user what the server said', async () => {
    server.use(
      http.post('*/api/v1/shopping-lists/:id/items', () =>
        HttpResponse.json({ detail: { error_code: 'shopping.error.list_not_found', message: 'Shopping list not found.' } }, { status: 400 })
      )
    )
    const { wrapper, items } = setup()
    const { result } = renderHook(() => useAddShoppingItem(LIST_ID), { wrapper })

    act(() => {
      result.current.mutate({ name: 'Bread', quantity: 1, unit: 'stk' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(items().map((item) => item.id)).toEqual([EXISTING_ID])
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add the item. Shopping list not found.')
  })

  it('says the service is unreachable when the request never gets a response', async () => {
    server.use(http.post('*/api/v1/shopping-lists/:id/items', () => HttpResponse.error()))
    const { wrapper } = setup()
    const { result } = renderHook(() => useAddShoppingItem(LIST_ID), { wrapper })

    act(() => {
      result.current.mutate({ name: 'Bread', quantity: 1, unit: 'stk' })
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add the item. The service could not be reached.')
  })
})

describe('useUpdateShoppingItem', () => {
  it('restores the previous state and notifies when the update fails', async () => {
    server.use(
      http.patch('*/api/v1/shopping-lists/:id/items/:itemId', () =>
        HttpResponse.json({ detail: 'Shopping item not found.' }, { status: 404 })
      )
    )
    const { wrapper, items } = setup()
    const { result } = renderHook(() => useUpdateShoppingItem(LIST_ID), { wrapper })

    act(() => {
      result.current.mutate({ itemId: EXISTING_ID, payload: { is_completed: true } })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(items()[0].is_completed).toBe(false)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the item. Shopping item not found.')
  })

  it('stays quiet when the caller presents the error itself', async () => {
    server.use(
      http.patch('*/api/v1/shopping-lists/:id/items/:itemId', () =>
        HttpResponse.json({ detail: 'Shopping item not found.' }, { status: 404 })
      )
    )
    const { wrapper } = setup()
    const { result } = renderHook(() => useUpdateShoppingItem(LIST_ID, { silent: true }), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ itemId: EXISTING_ID, payload: { name: 'x' } })).rejects.toMatchObject({
        status: 404,
      })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('useDeleteShoppingItem', () => {
  it('puts the item back and notifies when the delete fails', async () => {
    server.use(
      http.delete('*/api/v1/shopping-lists/:id/items/:itemId', () =>
        HttpResponse.json({ detail: 'Shopping item not found.' }, { status: 404 })
      )
    )
    const { wrapper, items } = setup()
    const { result } = renderHook(() => useDeleteShoppingItem(LIST_ID), { wrapper })

    act(() => {
      result.current.mutate(EXISTING_ID)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(items().map((item) => item.id)).toEqual([EXISTING_ID])
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove the item. Shopping item not found.')
  })
})
