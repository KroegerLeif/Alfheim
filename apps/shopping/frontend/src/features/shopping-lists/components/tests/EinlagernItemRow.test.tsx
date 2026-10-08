import React from 'react'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EinlagernItemRow } from '../EinlagernItemRow'
import type { LocalStateItem } from '../../hooks/useEinlagernItems'
import { setTestLocale } from '@/tests/locale'

const dummyItem: LocalStateItem = {
  shopping_item_id: 'item-1',
  name: 'Milk',
  quantity: 2,
  unit: 'l',
  reason: 'pantry.error.product_not_found',
  resolved: 'pending',
}

function renderRow(overrides: Partial<React.ComponentProps<typeof EinlagernItemRow>> = {}, item = dummyItem) {
  const props = {
    item,
    onEdit: vi.fn().mockResolvedValue(undefined),
    onSaveCatalog: vi.fn().mockResolvedValue(undefined),
    onSkip: vi.fn(),
    onRemove: vi.fn(),
    isCreateProductPending: false,
    ...overrides,
  }
  render(<EinlagernItemRow {...props} />)
  return props
}

describe('EinlagernItemRow Component', () => {
  it('renders the item with a localized unit and enters inline edit state', () => {
    renderRow()

    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('2 L')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Item' }))

    expect(screen.getByRole('button', { name: 'Confirm edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toBeInTheDocument()
  })

  it('shows the unit label in the active locale', () => {
    setTestLocale('de')
    renderRow({}, { ...dummyItem, unit: 'piece' })
    expect(screen.getByText('2 Stk')).toBeInTheDocument()
  })

  it('saves the edit and leaves edit mode', async () => {
    const props = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Item' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Item name' }), { target: { value: ' Oat Milk ' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Quantity' }), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm edit' }))

    await waitFor(() => expect(props.onEdit).toHaveBeenCalledWith('Oat Milk', 3))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm edit' })).not.toBeInTheDocument())
  })

  it('keeps the editor open and shows the message when persisting the edit fails', async () => {
    renderRow({ onEdit: vi.fn().mockRejectedValue(new Error('Could not save the changes to the item. Boom')) })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm edit' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes to the item. Boom')
    expect(screen.getByRole('button', { name: 'Confirm edit' })).toBeInTheDocument()
  })

  it('submits the catalog name and surfaces a failed save inline', async () => {
    const onSaveCatalog = vi.fn().mockRejectedValue(new Error('Could not create the catalog entry. Conflict'))
    renderRow({ onSaveCatalog })

    fireEvent.click(screen.getByRole('button', { name: 'Save to Catalog' }))
    fireEvent.change(screen.getByLabelText('Catalog Product Name:'), { target: { value: 'Oat Milk 1L' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaveCatalog).toHaveBeenCalledWith('Oat Milk 1L'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the catalog entry. Conflict')
    // The form stays open so the user can retry.
    expect(screen.getByLabelText('Catalog Product Name:')).toBeInTheDocument()
  })

  it('clips a very long name and keeps the actions reachable', () => {
    const name = 'Extra long product name '.repeat(30).trim()
    renderRow({}, { ...dummyItem, name })
    const title = screen.getByText(name)
    expect(title).toHaveClass('truncate')
    expect(title).toHaveAttribute('title', name)
    expect(screen.getByRole('button', { name: 'Skip Item' })).toBeInTheDocument()
  })
})
