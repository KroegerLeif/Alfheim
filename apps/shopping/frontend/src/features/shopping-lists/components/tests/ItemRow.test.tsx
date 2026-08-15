import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ItemRow } from '../ItemRow'
import { createQueryWrapper } from '@/tests/utils'

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('ItemRow Component', () => {
  const mockItem = {
    id: 'h1',
    list_id: 'list1',
    name: 'Vollmilch',
    brand: 'Bio',
    barcode: '123456',
    quantity: 2,
    unit: 'L',
    is_completed: false,
    is_auto_generated: false,
    is_synced: false,
    product_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('renders active item details, name, brand, quantity and unit', () => {
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={mockItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    // Name + Brand text
    expect(screen.getByText(/Vollmilch/)).toBeInTheDocument()
    expect(screen.getByText(/(Bio)/)).toBeInTheDocument()

    // Quantity + Unit text
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()

    // No pantry badge since product_id is null
    expect(screen.queryByText('pantryBadge')).not.toBeInTheDocument()
  })

  it('displays line-through typography when item is completed', () => {
    const completedItem = { ...mockItem, is_completed: true }
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={completedItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    const textNode = screen.getByText(/Vollmilch/)
    expect(textNode).toHaveClass('line-through')
  })

  it('renders the Pantry badge when item has a product_id mapping', () => {
    const linkedItem = { ...mockItem, product_id: 'pantry-uuid-123' }
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={linkedItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    expect(screen.getByText('pantryBadge')).toBeInTheDocument()
  })

  it('calls onToggle callback when clicking the row', () => {
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={mockItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    const row = screen.getByText(/Vollmilch/).closest('div')
    expect(row).toBeInTheDocument()
    fireEvent.click(row!)

    expect(handleToggle).toHaveBeenCalledTimes(1)
  })
})
