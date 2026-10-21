import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ChecklistContainer } from '../ChecklistContainer'
import { AddManualItem } from '../AddManualItem'
import { ListSelector } from '../ListSelector'
import { createQueryWrapper, createTestQueryClient } from '@/tests/utils'
import { server } from '@/tests/mocks/server'
import { makeItem } from '@/tests/mocks/handlers'
import type { ShoppingList } from '../../types'

const LIST_ID = '11111111-1111-4111-a111-111111111111'

function list(isPersonal: boolean): ShoppingList {
  const now = new Date().toISOString()
  return {
    id: LIST_ID,
    name: 'Weekly',
    home_id: '33333333-3333-4333-a333-333333333333',
    owner_id: '44444444-4444-4444-a444-444444444444',
    is_default: !isPersonal,
    is_personal: isPersonal,
    position: 0,
    created_at: now,
    updated_at: now,
    items: [
      makeItem({ id: '55555555-5555-4555-a555-555555555551', name: 'Milk' }),
      makeItem({ id: '55555555-5555-4555-a555-555555555552', name: 'Bread', is_completed: true }),
    ] as ShoppingList['items'],
  }
}

function renderList(role: string, isPersonal: boolean) {
  server.use(
    http.get('*/api/v1/shopping-lists', () => HttpResponse.json([list(isPersonal)])),
    http.get('*/api/v1/shopping-lists/:id', () => HttpResponse.json(list(isPersonal)))
  )
  return render(
    <>
      <ChecklistContainer listId={LIST_ID} />
      <AddManualItem listId={LIST_ID} />
    </>,
    { wrapper: createQueryWrapper(createTestQueryClient(), role) }
  )
}

describe('household role gating', () => {
  it('GUEST sees a shared list read-only with a hint instead of the add form', async () => {
    renderList('GUEST', false)
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as checked' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Remove item' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('note')).toBeInTheDocument())
    expect(screen.queryByLabelText('Item name')).toBeNull()
  })

  it('GUEST keeps full control of the Personal List', async () => {
    renderList('GUEST', true)
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as checked' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Item name')).toBeInTheDocument()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it.each(['MEMBER', 'ADMIN'])('%s can edit a shared list', async (role) => {
    renderList(role, false)
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as checked' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Item name')).toBeInTheDocument()
  })

  it.each([
    ['GUEST', false],
    ['MEMBER', true],
    ['ADMIN', true],
  ])('%s can create shared lists: %s', async (role, allowed) => {
    render(<ListSelector activeListId={LIST_ID} onSelect={vi.fn()} />, {
      wrapper: createQueryWrapper(createTestQueryClient(), role),
    })
    expect(await screen.findByText('Party Supplies')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New List' }) !== null).toBe(allowed)
  })
})
