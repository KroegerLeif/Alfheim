import React from 'react'
import { screen, render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EinlagernItemRow, LocalStateItem } from '../EinlagernItemRow'

describe('EinlagernItemRow Component', () => {
  const dummyItem: LocalStateItem = {
    shopping_item_id: 'item-1',
    name: 'Milk',
    quantity: 2,
    unit: 'l',
    reason: 'pantry.error.product_not_found',
    resolved: 'pending',
  }

  it('renders item row and allows entering inline edit state with localized buttons', () => {
    const onEdit = vi.fn()
    const onSaveCatalog = vi.fn().mockResolvedValue(undefined)
    const onSkip = vi.fn()
    const onRemove = vi.fn()

    render(
      <EinlagernItemRow
        item={dummyItem}
        onEdit={onEdit}
        onSaveCatalog={onSaveCatalog}
        onSkip={onSkip}
        onRemove={onRemove}
        isCreateProductPending={false}
      />
    )

    expect(screen.getByText('Milk')).toBeInTheDocument()

    // Click edit button
    const editBtn = screen.getByTitle('editItem')
    fireEvent.click(editBtn)

    // Verify confirm and cancel buttons are rendered with localized labels
    expect(screen.getByTitle('confirmEdit')).toBeInTheDocument()
    expect(screen.getByTitle('cancelEdit')).toBeInTheDocument()
  })
})
